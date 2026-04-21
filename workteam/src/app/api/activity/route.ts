export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { canUserDeleteActivityLog } from "@/lib/activity-scope";
import { db } from "@/lib/db";
import { getVisibleDepartmentIds } from "@/lib/org-scope";
import { getSessionFromRequest } from "@/lib/session";
import { getUserContext } from "@/lib/user-context";
import type { ActivityActionType, ActivityFilter, ActivityItemDTO } from "@/types/activity";

const querySchema = z.object({
  filter: z
    .enum(["all", "chat", "task", "note", "file", "calendar", "document"])
    .optional()
    .default("all"),
  cursorCreatedAt: z.string().datetime().optional(),
  cursorId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  q: z.string().max(200).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional()
});

const FILTER_TO_ACTIONS: Record<ActivityFilter, ActivityActionType[]> = {
  all: [],
  chat: ["message_sent", "member_joined"],
  task: ["task_created", "task_moved", "task_completed"],
  note: ["note_created", "note_updated"],
  file: ["file_uploaded"],
  calendar: ["event_created"],
  document: [
    "document_viewed",
    "document_created",
    "document_updated",
    "document_version_created",
    "document_approved",
    "document_archived"
  ]
};

function linkForActivity(entityType: string, entityId: string, metadata: Record<string, unknown>): string {
  const custom = metadata.url;
  if (typeof custom === "string" && custom.trim()) {
    return custom;
  }
  if (entityType === "task") return "/tasks";
  if (entityType === "note") return `/meeting-notes?id=${encodeURIComponent(entityId)}`;
  if (entityType === "event") return "/calendar";
  if (entityType === "channel") return "/chat";
  if (entityType === "document") return "/activity-feed";
  if (entityType === "workspace") return "/activity-feed";
  return "/activity-feed";
}

function parseDateParam(raw: string | undefined, label: string): Date | null {
  if (!raw || !raw.trim()) {
    return null;
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new Error(label);
  }
  return d;
}

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const ctx = await getUserContext(session.sub);
  if (!ctx) {
    return NextResponse.json({ message: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  const parsed = querySchema.safeParse({
    filter: request.nextUrl.searchParams.get("filter") ?? undefined,
    cursorCreatedAt: request.nextUrl.searchParams.get("cursorCreatedAt") ?? undefined,
    cursorId: request.nextUrl.searchParams.get("cursorId") ?? undefined,
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
    q: request.nextUrl.searchParams.get("q") ?? undefined,
    dateFrom: request.nextUrl.searchParams.get("dateFrom") ?? undefined,
    dateTo: request.nextUrl.searchParams.get("dateTo") ?? undefined
  });
  if (!parsed.success) {
    return NextResponse.json({ message: "쿼리가 올바르지 않습니다." }, { status: 400 });
  }

  const { filter, cursorCreatedAt, cursorId, limit, q, dateFrom, dateTo } = parsed.data;
  if ((cursorCreatedAt && !cursorId) || (!cursorCreatedAt && cursorId)) {
    return NextResponse.json({ message: "cursorCreatedAt, cursorId를 함께 전달해 주세요." }, { status: 400 });
  }

  let dateFromD: Date | null;
  let dateToD: Date | null;
  try {
    dateFromD = parseDateParam(dateFrom, "dateFrom");
    dateToD = parseDateParam(dateTo, "dateTo");
  } catch {
    return NextResponse.json({ message: "날짜 형식이 올바르지 않습니다." }, { status: 400 });
  }
  if (dateFromD && dateToD && dateFromD.getTime() > dateToD.getTime()) {
    return NextResponse.json({ message: "시작일이 종료일보다 늦을 수 없습니다." }, { status: 400 });
  }

  const where: string[] = [];
  const params: unknown[] = [];
  let p = 1;

  if (ctx.role !== "admin") {
    const scope = await getVisibleDepartmentIds(ctx);
    where.push(
      `(
        (al.department_id = ANY($${p}::uuid[]) OR (al.department_id IS NULL AND al.user_id = $${p + 1}::uuid))
        OR (
          al.entity_type = 'document'
          AND EXISTS (
            SELECT 1 FROM documents d
            INNER JOIN workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = $${p + 1}::uuid
            WHERE d.id = al.entity_id
          )
        )
        OR (
          al.entity_type = 'workspace'
          AND EXISTS (
            SELECT 1 FROM workspace_members wm
            WHERE wm.workspace_id = al.entity_id AND wm.user_id = $${p + 1}::uuid
          )
        )
      )`
    );
    params.push(scope, ctx.id);
    p += 2;
  }

  const actions = FILTER_TO_ACTIONS[filter];
  if (actions.length > 0) {
    where.push(`al.action_type = ANY($${p}::text[])`);
    params.push(actions);
    p += 1;
  }

  const qTrim = typeof q === "string" ? q.trim() : "";
  if (qTrim.length > 0) {
    const like = `%${qTrim}%`;
    where.push(
      `(u.name ILIKE $${p} OR al.entity_name ILIKE $${p + 1} OR al.action_type::text ILIKE $${p + 2})`
    );
    params.push(like, like, like);
    p += 3;
  }

  if (dateFromD) {
    where.push(`al.created_at >= $${p}::timestamptz`);
    params.push(dateFromD.toISOString());
    p += 1;
  }
  if (dateToD) {
    where.push(`al.created_at <= $${p}::timestamptz`);
    params.push(dateToD.toISOString());
    p += 1;
  }

  if (cursorCreatedAt && cursorId) {
    where.push(`(al.created_at, al.id) < ($${p}::timestamptz, $${p + 1}::uuid)`);
    params.push(cursorCreatedAt, cursorId);
    p += 2;
  }

  const sqlWhere = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const rows = await db.query<{
    id: string;
    user_id: string;
    user_name: string;
    user_email: string;
    action_type: ActivityActionType;
    entity_type: string;
    entity_id: string;
    entity_name: string;
    department_id: string | null;
    department_name: string | null;
    metadata: Record<string, unknown> | null;
    created_at: Date;
  }>(
    `
    SELECT
      al.id::text,
      al.user_id::text,
      u.name AS user_name,
      u.email AS user_email,
      al.action_type,
      al.entity_type,
      al.entity_id::text,
      al.entity_name,
      al.department_id::text,
      d.name AS department_name,
      al.metadata,
      al.created_at
    FROM activity_logs al
    INNER JOIN users u ON u.id = al.user_id
    LEFT JOIN departments d ON d.id = al.department_id
    ${sqlWhere}
    ORDER BY al.created_at DESC, al.id DESC
    LIMIT $${p}
    `,
    [...params, limit + 1]
  );

  const hasMore = rows.rows.length > limit;
  const sliced = rows.rows.slice(0, limit);
  const items: ActivityItemDTO[] = sliced.map((r) => {
    const metadata = (r.metadata ?? {}) as Record<string, unknown>;
    const canDelete = canUserDeleteActivityLog(ctx, r.user_id);
    return {
      id: r.id,
      userId: r.user_id,
      userName: r.user_name,
      userEmail: r.user_email,
      actionType: r.action_type,
      entityType: r.entity_type as ActivityItemDTO["entityType"],
      entityId: r.entity_id,
      entityName: r.entity_name,
      departmentId: r.department_id,
      departmentName: r.department_name,
      metadata,
      createdAt: r.created_at.toISOString(),
      link: linkForActivity(r.entity_type, r.entity_id, metadata),
      canDelete: canDelete ? true : undefined
    };
  });
  const last = items[items.length - 1];
  return NextResponse.json({
    items,
    nextCursor: hasMore && last ? { cursorCreatedAt: last.createdAt, cursorId: last.id } : null
  });
}
