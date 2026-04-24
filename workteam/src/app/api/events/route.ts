export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { DatabaseError } from "pg";
import { z } from "zod";
import { db } from "@/lib/db";
import { createActivityLogSafe } from "@/lib/activity-log";
import { getVisibleDepartmentIds, isDepartmentIdInScope } from "@/lib/org-scope";
import { getSessionFromRequest } from "@/lib/session";
import { getUserContext } from "@/lib/user-context";
import type { CalendarKind } from "@/types/calendar";

const kindSchema = z.enum(["personal", "team", "announcement"]);
const eventColorSchema = z
  .enum(["#ffd4de", "#ffe6d5", "#fff3d7", "#e0f7d8", "#d8eeff", "#f3def9"])
  .nullable();

/** ISO·로컬 등 Date.parse로 해석 가능한 문자열 (node-pg timestamptz와 호환) */
const isoDateTimeString = z
  .string()
  .min(1)
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: "유효한 날짜·시간 형식이 아닙니다." });

function normalizeAttendeeUserIds(raw: unknown): string[] {
  if (raw == null || raw === "") return [];
  if (Array.isArray(raw)) {
    return raw
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter(Boolean);
  }
  return [];
}

const postBodySchema = z
  .object({
    title: z.string().min(1).max(500),
    description: z.string().nullable().optional(),
    startsAt: isoDateTimeString,
    endsAt: isoDateTimeString,
    kind: kindSchema,
    color: eventColorSchema.optional(),
    departmentId: z.string().uuid().nullable().optional(),
    attendeeUserIds: z.preprocess(normalizeAttendeeUserIds, z.array(z.string().uuid()).max(50)).optional()
  })
  .superRefine((data, ctx) => {
    if (data.kind === "team" && (data.departmentId == null || data.departmentId === "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "팀 일정에는 부서가 필요합니다.",
        path: ["departmentId"]
      });
    }
    if (data.kind !== "team" && data.departmentId != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "팀 일정에만 부서를 지정할 수 있습니다.",
        path: ["departmentId"]
      });
    }
  });

function logPostEventsFailure(context: string, err: unknown, extra?: Record<string, unknown>) {
  if (err instanceof DatabaseError) {
    console.error(`[POST /api/events] ${context}`, {
      ...extra,
      message: err.message,
      code: err.code,
      detail: err.detail,
      constraint: err.constraint,
      table: err.table,
      column: err.column,
      severity: err.severity,
      position: err.position
    });
    return;
  }
  console.error(`[POST /api/events] ${context}`, {
    ...extra,
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined
  });
}

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  starts_at: Date;
  ends_at: Date;
  kind: CalendarKind;
  color: string | null;
  department_id: string | null;
  attendee_user_ids: string[];
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
};

async function resolveAttendees(userIds: string[]) {
  if (userIds.length === 0) return [];
  const res = await db.query<{ id: string; name: string; email: string }>(
    `SELECT id::text, name, email FROM users WHERE id = ANY($1::uuid[])`,
    [userIds]
  );
  return res.rows;
}

function mapEvent(row: EventRow, attendees: { id: string; name: string; email: string }[]) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(),
    color: row.color,
    kind: row.kind,
    departmentId: row.department_id,
    attendeeUserIds: row.attendee_user_ids ?? [],
    attendees,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const departmentId = searchParams.get("departmentId")?.trim() || null;
  if (!from || !to) {
    return NextResponse.json({ message: "from, to 쿼리가 필요합니다 (YYYY-MM-DD)." }, { status: 400 });
  }
  if (departmentId && !/^[0-9a-fA-F-]{36}$/.test(departmentId)) {
    return NextResponse.json({ message: "departmentId 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const rangeStart = `${from}T00:00:00.000Z`;
  const endDate = new Date(`${to}T00:00:00.000Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  const rangeEndExclusive = endDate.toISOString();

  const ctx = await getUserContext(session.sub);
  if (!ctx) {
    return NextResponse.json({ message: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  let filterSql = "";
  const filterParams: unknown[] = [rangeStart, rangeEndExclusive];
  if (ctx.role === "admin") {
    if (departmentId) {
      filterSql = `
        (e.kind = 'team' AND e.department_id = $3::uuid)
      `;
      filterParams.push(departmentId);
    } else {
      filterSql = `
        (e.kind = 'announcement'
          OR (e.kind = 'personal' AND (e.created_by = $3::uuid OR $3::uuid = ANY(e.attendee_user_ids)))
          OR (e.kind = 'team'))
      `;
      filterParams.push(ctx.id);
    }
  } else {
    const scope = await getVisibleDepartmentIds(ctx);
    if (departmentId && !scope.includes(departmentId)) {
      return NextResponse.json({ message: "해당 부서 조회 권한이 없습니다." }, { status: 403 });
    }
    if (departmentId) {
      filterSql = `
        (e.kind = 'team' AND e.department_id = $3::uuid)
      `;
      filterParams.push(departmentId);
    } else {
      filterSql = `
        (e.kind = 'announcement'
          OR (e.kind = 'personal' AND (e.created_by = $3::uuid OR $3::uuid = ANY(e.attendee_user_ids)))
          OR (e.kind = 'team' AND e.department_id IS NOT NULL AND e.department_id = ANY($4::uuid[])))
      `;
      filterParams.push(ctx.id, scope);
    }
  }

  const result = await db.query<EventRow>(
    `
    SELECT
      e.id,
      e.title,
      e.description,
      e.starts_at,
      e.ends_at,
      e.color,
      e.kind,
      e.department_id::text,
      e.attendee_user_ids,
      e.created_by,
      e.created_at,
      e.updated_at
    FROM events e
    WHERE e.starts_at < $2::timestamptz AND e.ends_at > $1::timestamptz
      AND (${filterSql})
    ORDER BY e.starts_at ASC
    `,
    filterParams
  );

  const events = [];
  for (const row of result.rows) {
    const attendees = await resolveAttendees(row.attendee_user_ids ?? []);
    events.push(mapEvent(row, attendees));
  }

  return NextResponse.json({ events });
}

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const ctx = await getUserContext(session.sub);
  if (!ctx) {
    return NextResponse.json({ message: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "잘못된 JSON입니다." }, { status: 400 });
  }

  const parsed = postBodySchema.safeParse(body);
  if (!parsed.success) {
    console.error("[POST /api/events] validation failed", {
      issues: parsed.error.flatten(),
      bodyPreview: typeof body === "object" && body !== null ? JSON.stringify(body).slice(0, 500) : body
    });
    return NextResponse.json({ message: "입력값이 올바르지 않습니다.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const {
    title,
    description = null,
    startsAt,
    endsAt,
    kind,
    color = null,
    departmentId = null,
    attendeeUserIds = []
  } = parsed.data;

  const departmentForDb = kind === "team" ? departmentId : null;
  if (kind === "announcement" && ctx.role !== "admin") {
    return NextResponse.json({ message: "전사 공지는 관리자만 등록할 수 있습니다." }, { status: 403 });
  }
  if (kind === "team" && departmentForDb && !(await isDepartmentIdInScope(ctx, departmentForDb))) {
    return NextResponse.json({ message: "선택한 부서에 일정을 등록할 권한이 없습니다." }, { status: 403 });
  }

  const checkDates = new Date(startsAt) < new Date(endsAt);
  if (!checkDates) {
    return NextResponse.json({ message: "종료 시간이 시작 시간보다 늦어야 합니다." }, { status: 400 });
  }

  /** 빈 JS 배열은 node-pg에서 uuid[]로 추론되지 않아 COALESCE(NULL, ARRAY[]::uuid[])로 저장 */
  const attendeeParam: string[] | null = attendeeUserIds.length === 0 ? null : attendeeUserIds;

  let createdByUserId: string;
  try {
    const creatorRes = await db.query<{ id: string }>(
      `SELECT id::text AS id FROM users WHERE id = $1::uuid LIMIT 1`,
      [session.sub]
    );
    if (creatorRes.rowCount === 0) {
      console.error("[POST /api/events] created_by: no user for session.sub (JWT sub not in DB)", {
        sessionSub: session.sub
      });
      return NextResponse.json(
        { message: "세션이 유효하지 않습니다. 다시 로그인해 주세요." },
        { status: 401 }
      );
    }
    createdByUserId = creatorRes.rows[0].id;
  } catch (e) {
    logPostEventsFailure("created_by lookup failed (invalid UUID or DB error)", e, { sessionSub: session.sub });
    return NextResponse.json(
      { message: "세션 정보를 확인할 수 없습니다. 다시 로그인해 주세요." },
      { status: 401 }
    );
  }

  console.info("[POST /api/events] inserting", {
    titleLen: title.length,
    kind,
    attendeeCount: attendeeUserIds.length,
    createdByUserId
  });

  try {
    const insert = await db.query<EventRow>(
      `
      INSERT INTO events (
        title, description, starts_at, ends_at, kind, color, department_id, attendee_user_ids, created_by
      )
      VALUES (
        $1,
        $2,
        $3::timestamptz,
        $4::timestamptz,
        $5,
        $6,
        $7::uuid,
        COALESCE($8::uuid[], ARRAY[]::uuid[]),
        $9::uuid
      )
      RETURNING
        id,
        title,
        description,
        starts_at,
        ends_at,
        color,
        kind,
        department_id::text,
        attendee_user_ids,
        created_by,
        created_at,
        updated_at
      `,
      [title, description, startsAt, endsAt, kind, color, departmentForDb, attendeeParam, createdByUserId]
    );

    const row = insert.rows[0];
    const attendees = await resolveAttendees(row.attendee_user_ids ?? []);
    await createActivityLogSafe({
      userId: session.sub,
      actionType: "event_created",
      entityType: "event",
      entityId: row.id,
      entityName: row.title,
      departmentId: row.department_id,
      metadata: { kind: row.kind, url: "/calendar" }
    });

    console.info("[POST /api/events] success", { eventId: row.id });

    return NextResponse.json({ event: mapEvent(row, attendees) });
  } catch (e) {
    logPostEventsFailure("INSERT failed", e, {
      titleLen: title.length,
      kind,
      attendeeCount: attendeeUserIds.length,
      createdByUserId
    });
    return NextResponse.json({ message: "일정을 저장하지 못했습니다." }, { status: 500 });
  }
}
