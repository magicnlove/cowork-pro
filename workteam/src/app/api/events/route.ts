export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { DatabaseError } from "pg";
import dayjs from "dayjs";
import { randomUUID } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { createActivityLogSafe } from "@/lib/activity-log";
import { getVisibleDepartmentIds, isDepartmentIdInScope } from "@/lib/org-scope";
import { getSessionFromRequest } from "@/lib/session";
import { getUserContext } from "@/lib/user-context";
import type { CalendarKind } from "@/types/calendar";
import { expandRecurringStarts } from "@/lib/expand-recurring-starts";
import { computeInstanceEndsAt } from "@/lib/recurring-instance-end";

const kindSchema = z.enum(["personal", "team", "announcement"]);
const eventColorSchema = z
  .enum(["#ffd4de", "#ffe6d5", "#fff3d7", "#e0f7d8", "#d8eeff", "#f3def9"])
  .nullable();
const recurrenceTypeSchema = z.enum(["none", "daily", "weekly", "weekday", "monthly", "yearly"]);

/** ISO·로컬 등 Date.parse로 해석 가능한 문자열 (node-pg timestamptz와 호환) */
const isoDateTimeString = z
  .string()
  .min(1)
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: "유효한 날짜·시간 형식이 아닙니다." });
const ymdDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "날짜 형식은 YYYY-MM-DD 이어야 합니다." });

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
    recurrenceType: recurrenceTypeSchema.optional(),
    recurrenceStartDate: ymdDateString.optional(),
    recurrenceDays: z.array(z.number().int().min(1).max(7)).max(7).optional(),
    recurrenceEndDate: z.preprocess(
      (v) => (v === null || v === "" ? undefined : v),
      ymdDateString.optional()
    ),
    recurrenceDetail: z.preprocess(
      (v) => (v === null ? undefined : v),
      z.record(z.string(), z.unknown()).optional()
    ),
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
    if (data.recurrenceType && data.recurrenceType !== "none") {
      if (!data.recurrenceEndDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "반복 종료일이 필요합니다.",
          path: ["recurrenceEndDate"]
        });
      }
      if (data.recurrenceType === "weekly" && (!data.recurrenceDays || data.recurrenceDays.length === 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "매주 반복은 요일 선택이 필요합니다.",
          path: ["recurrenceDays"]
        });
      }
      const startBase = data.recurrenceStartDate
        ? `${data.recurrenceStartDate}T00:00:00.000Z`
        : data.startsAt;
      const startDate = new Date(startBase);
      const endDate = new Date(`${data.recurrenceEndDate}T23:59:59.999Z`);
      if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime()) && endDate <= startDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "반복 종료일은 시작일 이후여야 합니다.",
          path: ["recurrenceEndDate"]
        });
      }
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
  recurrence_type: "none" | "daily" | "weekly" | "weekday" | "monthly" | "yearly";
  recurrence_days: string | null;
  recurrence_end_date: string | null;
  recurrence_detail: Record<string, unknown> | null;
  recurrence_group_id: string | null;
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

async function resolveAttendeesMap(rows: EventRow[]) {
  const idSet = new Set<string>();
  for (const row of rows) {
    for (const uid of row.attendee_user_ids ?? []) idSet.add(uid);
  }
  const allIds = [...idSet];
  if (allIds.length === 0) return new Map<string, { id: string; name: string; email: string }[]>();
  const users = await resolveAttendees(allIds);
  const byId = new Map(users.map((u) => [u.id, u] as const));
  const out = new Map<string, { id: string; name: string; email: string }[]>();
  for (const row of rows) {
    const attendees = (row.attendee_user_ids ?? []).map((id) => byId.get(id)).filter(Boolean) as {
      id: string;
      name: string;
      email: string;
    }[];
    out.set(row.id, attendees);
  }
  return out;
}

async function resolveCreatorsMap(rows: EventRow[]) {
  const creatorIds = [...new Set(rows.map((r) => r.created_by).filter(Boolean) as string[])];
  if (creatorIds.length === 0) {
    return new Map<string, { name: string; departmentName: string | null }>();
  }
  const res = await db.query<{
    id: string;
    name: string;
    department_name: string | null;
  }>(
    `
    SELECT
      u.id::text AS id,
      u.name,
      d.name AS department_name
    FROM users u
    LEFT JOIN LATERAL (
      SELECT ud.department_id
      FROM user_departments ud
      WHERE ud.user_id = u.id
      ORDER BY ud.is_primary DESC, ud.created_at ASC
      LIMIT 1
    ) picked ON true
    LEFT JOIN departments d ON d.id = picked.department_id
    WHERE u.id = ANY($1::uuid[])
    `,
    [creatorIds]
  );
  return new Map(res.rows.map((r) => [r.id, { name: r.name, departmentName: r.department_name }] as const));
}

function mapEvent(
  row: EventRow,
  attendees: { id: string; name: string; email: string }[],
  createdByUser: { name: string; departmentName: string | null } | null
) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(),
    color: row.color,
    recurrenceType: row.recurrence_type ?? "none",
    recurrenceDays: row.recurrence_days,
    recurrenceEndDate: row.recurrence_end_date,
    recurrenceDetail: row.recurrence_detail,
    recurrenceGroupId: row.recurrence_group_id,
    kind: row.kind,
    departmentId: row.department_id,
    attendeeUserIds: row.attendee_user_ids ?? [],
    attendees,
    createdBy: row.created_by,
    createdByUser,
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
    if (departmentId) {
      filterSql = `
        (e.kind = 'team' AND e.department_id = $3::uuid
          AND ($4::uuid = ANY(e.attendee_user_ids) OR e.department_id = ANY($5::uuid[])))
      `;
      filterParams.push(departmentId, ctx.id, scope);
    } else {
      filterSql = `
        (e.kind = 'announcement'
          OR (e.kind = 'personal' AND (e.created_by = $3::uuid OR $3::uuid = ANY(e.attendee_user_ids)))
          OR (e.kind = 'team' AND (
            $3::uuid = ANY(e.attendee_user_ids)
            OR (e.department_id IS NOT NULL AND e.department_id = ANY($4::uuid[]))
          )))
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
      e.recurrence_type,
      e.recurrence_days,
      e.recurrence_end_date::text,
      e.recurrence_detail,
      e.recurrence_group_id::text,
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

  const attendeeMap = await resolveAttendeesMap(result.rows);
  const creatorMap = await resolveCreatorsMap(result.rows);
  const events = result.rows.map((row) =>
    mapEvent(row, attendeeMap.get(row.id) ?? [], row.created_by ? creatorMap.get(row.created_by) ?? null : null)
  );

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
    recurrenceType = "none",
    recurrenceStartDate,
    recurrenceDays = [],
    recurrenceEndDate,
    recurrenceDetail: recurrenceDetailRaw = undefined,
    departmentId = null,
    attendeeUserIds = []
  } = parsed.data;
  const mergedRecurrenceDetail =
    recurrenceType !== "none"
      ? {
          ...(recurrenceDetailRaw && typeof recurrenceDetailRaw === "object" ? recurrenceDetailRaw : {}),
          ...(recurrenceStartDate ? { anchorStartDate: recurrenceStartDate } : {})
        }
      : null;
  console.info("[POST /api/events] parsed recurrence payload", {
    recurrenceType,
    recurrenceStartDate: recurrenceStartDate ?? null,
    recurrenceDays,
    recurrenceEndDate: recurrenceEndDate ?? null,
    recurrenceDetail: mergedRecurrenceDetail ?? recurrenceDetailRaw
  });

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
  const recurrenceDaysStr =
    recurrenceType === "weekly" && recurrenceDays.length > 0
      ? [...new Set(recurrenceDays)].sort((a, b) => a - b).join(",")
      : null;
  const recurrenceGroupId = recurrenceType !== "none" ? randomUUID() : null;

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
    const recurrenceBaseStartsAt = recurrenceStartDate
      ? dayjs(`${recurrenceStartDate}T00:00:00.000Z`)
          .hour(dayjs(startsAt).hour())
          .minute(dayjs(startsAt).minute())
          .second(0)
          .millisecond(0)
          .toISOString()
      : startsAt;
    const recurrenceBaseEndsAt = recurrenceStartDate
      ? dayjs(recurrenceBaseStartsAt)
          .add(new Date(endsAt).getTime() - new Date(startsAt).getTime(), "millisecond")
          .toISOString()
      : endsAt;
    const instanceStarts = expandRecurringStarts(
      recurrenceBaseStartsAt,
      recurrenceType,
      recurrenceEndDate,
      recurrenceDays,
      recurrenceType !== "none" ? mergedRecurrenceDetail : recurrenceDetailRaw
    );
    console.info("[POST /api/events] recurrence expansion", {
      recurrenceType,
      recurrenceStartDate: recurrenceStartDate ?? null,
      recurrenceEndDate: recurrenceEndDate ?? null,
      recurrenceDays: recurrenceDaysStr,
      recurrenceDetail: mergedRecurrenceDetail ?? recurrenceDetailRaw,
      recurrenceGroupId,
      startsAt: recurrenceBaseStartsAt,
      endsAt: recurrenceBaseEndsAt,
      generatedCount: instanceStarts.length,
      generatedStarts: instanceStarts.map((d) => d.toISOString())
    });
    const createdRows: EventRow[] = [];
    for (let idx = 0; idx < instanceStarts.length; idx++) {
      const instanceStart = instanceStarts[idx];
      const instanceEnd = computeInstanceEndsAt(
        instanceStart,
        recurrenceType,
        startsAt,
        endsAt,
        recurrenceDays
      );
      const insert = await db.query<EventRow>(
        `
        INSERT INTO events (
          title, description, starts_at, ends_at, kind, color, recurrence_type, recurrence_days, recurrence_end_date, recurrence_detail, recurrence_group_id, department_id, attendee_user_ids, created_by
        )
        VALUES (
          $1,
          $2,
          $3::timestamptz,
          $4::timestamptz,
          $5,
          $6,
          $7,
          $8,
          $9::date,
          $10::jsonb,
          $11::uuid,
          $12::uuid,
          COALESCE($13::uuid[], ARRAY[]::uuid[]),
          $14::uuid
        )
        RETURNING
          id,
          title,
          description,
          starts_at,
          ends_at,
          color,
          recurrence_type,
          recurrence_days,
          recurrence_end_date::text,
          recurrence_detail,
          recurrence_group_id::text,
          kind,
          department_id::text,
          attendee_user_ids,
          created_by,
          created_at,
          updated_at
        `,
        [
          title,
          description,
          instanceStart.toISOString(),
          instanceEnd.toISOString(),
          kind,
          color,
          recurrenceType,
          recurrenceDaysStr,
          recurrenceEndDate ?? null,
          recurrenceType !== "none" ? mergedRecurrenceDetail : null,
          recurrenceGroupId,
          departmentForDb,
          attendeeParam,
          createdByUserId
        ]
      );
      console.info("[POST /api/events] recurrence insert result", {
        index: idx,
        start: instanceStart.toISOString(),
        end: instanceEnd.toISOString(),
        rowCount: insert.rowCount,
        insertedId: insert.rows[0]?.id ?? null
      });
      if (insert.rows[0]) {
        createdRows.push(insert.rows[0]);
      }
    }
    if (createdRows.length === 0) {
      throw new Error("recurrence insert produced no rows");
    }

    const row = createdRows[0];
    const attendees = await resolveAttendees(row.attendee_user_ids ?? []);
    const creatorMap = await resolveCreatorsMap(createdRows);
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
    console.info("[POST /api/events] createdCount", {
      recurrenceType,
      createdCount: createdRows.length
    });

    return NextResponse.json({
      createdCount: createdRows.length,
      event: mapEvent(row, attendees, row.created_by ? creatorMap.get(row.created_by) ?? null : null)
    });
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
