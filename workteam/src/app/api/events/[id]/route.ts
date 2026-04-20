import { NextRequest, NextResponse } from "next/server";
import { DatabaseError } from "pg";
import { z } from "zod";
import { db } from "@/lib/db";
import { canUserEditEvent, canUserSeeEvent } from "@/lib/event-access";
import { isDepartmentIdInScope } from "@/lib/org-scope";
import { getSessionFromRequest } from "@/lib/session";
import { getUserContext } from "@/lib/user-context";
import type { CalendarKind } from "@/types/calendar";

const kindSchema = z.enum(["personal", "team", "announcement"]);

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

const patchBodySchema = z
  .object({
    title: z.string().min(1).max(500).optional(),
    description: z.string().nullable().optional(),
    startsAt: isoDateTimeString.optional(),
    endsAt: isoDateTimeString.optional(),
    kind: kindSchema.optional(),
    departmentId: z.string().uuid().nullable().optional(),
    attendeeUserIds: z.preprocess(normalizeAttendeeUserIds, z.array(z.string().uuid()).max(50)).optional()
  })
  .strict();

function logPatchEventsFailure(context: string, err: unknown, extra?: Record<string, unknown>) {
  if (err instanceof DatabaseError) {
    console.error(`[PATCH /api/events] ${context}`, {
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
  console.error(`[PATCH /api/events] ${context}`, {
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
    kind: row.kind,
    departmentId: row.department_id,
    attendeeUserIds: row.attendee_user_ids ?? [],
    attendees,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

type RouteCtx = { params: { id: string } };

export async function GET(_request: NextRequest, context: RouteCtx) {
  const session = getSessionFromRequest(_request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const ctx = await getUserContext(session.sub);
  if (!ctx) {
    return NextResponse.json({ message: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  const { id } = context.params;
  const res = await db.query<EventRow>(
    `
    SELECT
      id,
      title,
      description,
      starts_at,
      ends_at,
      kind,
      department_id::text,
      attendee_user_ids,
      created_by,
      created_at,
      updated_at
    FROM events WHERE id = $1::uuid
    `,
    [id]
  );
  const row = res.rows[0];
  if (!row) {
    return NextResponse.json({ message: "찾을 수 없습니다." }, { status: 404 });
  }
  if (
    !(await canUserSeeEvent(ctx, {
      kind: row.kind,
      department_id: row.department_id,
      created_by: row.created_by,
      attendee_user_ids: row.attendee_user_ids ?? []
    }))
  ) {
    return NextResponse.json({ message: "접근 권한이 없습니다." }, { status: 403 });
  }
  const attendees = await resolveAttendees(row.attendee_user_ids ?? []);
  return NextResponse.json({ event: mapEvent(row, attendees) });
}

export async function PATCH(request: NextRequest, context: RouteCtx) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const ctx = await getUserContext(session.sub);
  if (!ctx) {
    return NextResponse.json({ message: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  const { id } = context.params;

  const existingRes = await db.query<EventRow>(
    `
    SELECT
      id,
      title,
      description,
      starts_at,
      ends_at,
      kind,
      department_id::text,
      attendee_user_ids,
      created_by,
      created_at,
      updated_at
    FROM events WHERE id = $1::uuid
    `,
    [id]
  );
  const existing = existingRes.rows[0];
  if (!existing) {
    return NextResponse.json({ message: "찾을 수 없습니다." }, { status: 404 });
  }
  if (
    !(await canUserSeeEvent(ctx, {
      kind: existing.kind,
      department_id: existing.department_id,
      created_by: existing.created_by,
      attendee_user_ids: existing.attendee_user_ids ?? []
    }))
  ) {
    return NextResponse.json({ message: "접근 권한이 없습니다." }, { status: 403 });
  }
  if (!canUserEditEvent(ctx, existing.created_by)) {
    return NextResponse.json({ message: "수정 권한이 없습니다." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "잘못된 JSON입니다." }, { status: 400 });
  }

  const parsed = patchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "입력값이 올바르지 않습니다.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const fields: string[] = [];
  const values: unknown[] = [];
  let pn = 1;

  if (data.title !== undefined) {
    fields.push(`title = $${pn++}`);
    values.push(data.title);
  }
  if (data.description !== undefined) {
    fields.push(`description = $${pn++}`);
    values.push(data.description);
  }
  if (data.startsAt !== undefined) {
    fields.push(`starts_at = $${pn++}::timestamptz`);
    values.push(data.startsAt);
  }
  if (data.endsAt !== undefined) {
    fields.push(`ends_at = $${pn++}::timestamptz`);
    values.push(data.endsAt);
  }
  if (data.kind !== undefined) {
    fields.push(`kind = $${pn++}`);
    values.push(data.kind);
  }
  if (data.departmentId !== undefined) {
    const nextKind = data.kind ?? existing.kind;
    if (nextKind === "team") {
      if (!data.departmentId) {
        return NextResponse.json({ message: "팀 일정에는 부서가 필요합니다." }, { status: 400 });
      }
      if (!(await isDepartmentIdInScope(ctx, data.departmentId))) {
        return NextResponse.json({ message: "선택한 부서에 일정을 둘 권한이 없습니다." }, { status: 403 });
      }
    }
    fields.push(`department_id = $${pn++}::uuid`);
    values.push(nextKind === "team" ? data.departmentId : null);
  } else if (data.kind !== undefined && data.kind !== "team") {
    fields.push(`department_id = $${pn++}`);
    values.push(null);
  }
  if (data.attendeeUserIds !== undefined) {
    const attendeeParam = data.attendeeUserIds.length === 0 ? null : data.attendeeUserIds;
    fields.push(`attendee_user_ids = COALESCE($${pn++}::uuid[], ARRAY[]::uuid[])`);
    values.push(attendeeParam);
  }

  if (fields.length === 0) {
    return NextResponse.json({ message: "변경할 내용이 없습니다." }, { status: 400 });
  }

  fields.push("updated_at = NOW()");
  values.push(id);

  try {
    await db.query(
      `UPDATE events SET ${fields.join(", ")} WHERE id = $${pn}::uuid`,
      values
    );
  } catch (e) {
    logPatchEventsFailure("UPDATE failed", e, { eventId: id });
    return NextResponse.json({ message: "일정을 수정하지 못했습니다." }, { status: 500 });
  }

  const after = await db.query<EventRow>(
    `
    SELECT
      id,
      title,
      description,
      starts_at,
      ends_at,
      kind,
      department_id::text,
      attendee_user_ids,
      created_by,
      created_at,
      updated_at
    FROM events WHERE id = $1::uuid
    `,
    [id]
  );
  const row = after.rows[0];
  if (!row) {
    return NextResponse.json({ message: "찾을 수 없습니다." }, { status: 404 });
  }

  const starts = row.starts_at.getTime();
  const ends = row.ends_at.getTime();
  if (ends <= starts) {
    return NextResponse.json({ message: "종료 시간이 시작 시간보다 늦어야 합니다." }, { status: 400 });
  }

  const attendees = await resolveAttendees(row.attendee_user_ids ?? []);
  return NextResponse.json({ event: mapEvent(row, attendees) });
}

export async function DELETE(_request: NextRequest, context: RouteCtx) {
  const session = getSessionFromRequest(_request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const ctx = await getUserContext(session.sub);
  if (!ctx) {
    return NextResponse.json({ message: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  const { id } = context.params;
  const exRes = await db.query<{
    kind: CalendarKind;
    department_id: string | null;
    created_by: string | null;
    attendee_user_ids: string[];
  }>(
    `
    SELECT kind, department_id::text, created_by, attendee_user_ids
    FROM events WHERE id = $1::uuid
    `,
    [id]
  );
  const row = exRes.rows[0];
  if (!row) {
    return NextResponse.json({ message: "찾을 수 없습니다." }, { status: 404 });
  }
  if (
    !(await canUserSeeEvent(ctx, {
      kind: row.kind,
      department_id: row.department_id,
      created_by: row.created_by,
      attendee_user_ids: row.attendee_user_ids ?? []
    }))
  ) {
    return NextResponse.json({ message: "접근 권한이 없습니다." }, { status: 403 });
  }
  if (!canUserEditEvent(ctx, row.created_by)) {
    return NextResponse.json({ message: "삭제 권한이 없습니다." }, { status: 403 });
  }

  const result = await db.query(`DELETE FROM events WHERE id = $1::uuid RETURNING id`, [id]);
  if (result.rowCount === 0) {
    return NextResponse.json({ message: "찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
