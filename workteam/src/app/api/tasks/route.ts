export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { DatabaseError } from "pg";
import { z } from "zod";
import { broadcastNavBadgesRefresh } from "@/lib/activity-socket-broadcast";
import { db } from "@/lib/db";
import { createActivityLogSafe } from "@/lib/activity-log";
import { emitSocketToUser } from "@/lib/user-socket-broadcast";
import { getVisibleDepartmentIds } from "@/lib/org-scope";
import { getSessionFromRequest } from "@/lib/session";
import { getUserContext } from "@/lib/user-context";
import type { TaskPriority, TaskStatus } from "@/types/tasks";

const taskStatusSchema = z.enum(["backlog", "in_progress", "in_review", "done"]);
const prioritySchema = z.enum(["high", "medium", "low"]);

/** 쉼표 문자열·JSON 배열 모두 수용 → DB text[] 저장용 */
function normalizeTagsInput(raw: unknown): string[] {
  if (raw == null) {
    return [];
  }
  if (Array.isArray(raw)) {
    return raw
      .map((x) => String(x).trim())
      .filter(Boolean)
      .map((s) => s.slice(0, 40))
      .slice(0, 20);
  }
  if (typeof raw === "string") {
    return raw
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.slice(0, 40))
      .slice(0, 20);
  }
  return [];
}

function trimToNullUuid(v: unknown): string | null {
  if (v === "" || v === undefined || v === null) {
    return null;
  }
  if (typeof v === "string") {
    const t = v.trim();
    return t === "" ? null : t;
  }
  return null;
}

const postBodySchema = z.object({
  title: z.string().min(1).max(500),
  description: z
    .preprocess((v) => (v === "" || v === undefined ? null : v), z.union([z.string(), z.null()]).optional()),
  status: taskStatusSchema.optional(),
  priority: prioritySchema.optional(),
  dueDate: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.union([z.string(), z.null()]).optional()
  ),
  assigneeUserId: z.preprocess(trimToNullUuid, z.union([z.string().uuid(), z.null()]).optional()),
  tags: z.preprocess((v) => normalizeTagsInput(v), z.array(z.string().max(40)).max(20)).optional()
});

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assignee_user_id: string | null;
  assignee_name: string | null;
  tags: string[];
  position: number;
  department_id: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  is_new: boolean;
};

function formatDate(d: Date | string | null): string | null {
  if (d == null) return null;
  if (typeof d === "string") return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function mapRow(row: TaskRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueDate: formatDate(row.due_date),
    assigneeUserId: row.assignee_user_id,
    assigneeName: row.assignee_name,
    tags: row.tags ?? [],
    position: row.position,
    departmentId: row.department_id,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    isNew: Boolean(row.is_new)
  };
}

function logPostTasksFailure(context: string, err: unknown, extra?: Record<string, unknown>) {
  if (err instanceof DatabaseError) {
    console.error(`[POST /api/tasks] ${context}`, {
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
  console.error(`[POST /api/tasks] ${context}`, {
    ...extra,
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined
  });
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

  let filterSql = "";
  const filterParams: unknown[] = [session.sub];
  if (ctx.role !== "admin") {
    const scope = await getVisibleDepartmentIds(ctx);
    filterSql = ` WHERE (
      (t.department_id IS NOT NULL AND t.department_id = ANY($2::uuid[]))
      OR (t.department_id IS NULL AND t.created_by = $3::uuid)
    )`;
    filterParams.push(scope, ctx.id);
  }

  const result = await db.query<TaskRow>(
    `
    SELECT
      t.id,
      t.title,
      t.description,
      t.status,
      t.priority,
      t.due_date::text,
      t.assignee_user_id,
      u.name AS assignee_name,
      t.tags,
      t.position,
      t.department_id::text,
      t.created_by,
      t.created_at,
      t.updated_at,
      (
        t.status <> 'done'
        AND (utr.read_at IS NULL OR t.updated_at > utr.read_at)
      ) AS is_new
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assignee_user_id
    LEFT JOIN user_task_reads utr ON utr.task_id = t.id AND utr.user_id = $1::uuid
    ${filterSql}
    ORDER BY t.status, t.position ASC, t.created_at ASC
    `,
    filterParams
  );

  return NextResponse.json({ tasks: result.rows.map(mapRow) });
}

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "잘못된 JSON입니다." }, { status: 400 });
  }

  const parsed = postBodySchema.safeParse(body);
  if (!parsed.success) {
    console.error("[POST /api/tasks] validation failed", {
      issues: parsed.error.flatten(),
      bodyPreview: typeof body === "object" && body !== null ? JSON.stringify(body).slice(0, 500) : body
    });
    return NextResponse.json({ message: "입력값이 올바르지 않습니다.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const {
    title,
    description = null,
    status = "backlog",
    priority = "medium",
    dueDate = null,
    assigneeUserId = null,
    tags = []
  } = parsed.data;

  const tagsForDb = Array.isArray(tags) ? tags : normalizeTagsInput(tags);

  let createdByUserId: string;
  let taskDepartmentId: string | null;
  try {
    const creatorRes = await db.query<{ id: string; department_id: string | null }>(
      `
      SELECT
        u.id::text AS id,
        pud.department_id::text AS department_id
      FROM users u
      LEFT JOIN LATERAL (
        SELECT ud.department_id
        FROM user_departments ud
        WHERE ud.user_id = u.id
        ORDER BY ud.is_primary DESC, ud.created_at ASC
        LIMIT 1
      ) pud ON TRUE
      WHERE u.id = $1::uuid
      LIMIT 1
      `,
      [session.sub]
    );
    if (creatorRes.rowCount === 0) {
      console.error("[POST /api/tasks] created_by: no user for session.sub (JWT sub not in DB)", {
        sessionSub: session.sub
      });
      return NextResponse.json(
        { message: "세션이 유효하지 않습니다. 다시 로그인해 주세요." },
        { status: 401 }
      );
    }
    createdByUserId = creatorRes.rows[0].id;
    taskDepartmentId = creatorRes.rows[0].department_id;
  } catch (e) {
    logPostTasksFailure("created_by lookup failed (invalid UUID or DB error)", e, { sessionSub: session.sub });
    return NextResponse.json(
      { message: "세션 정보를 확인할 수 없습니다. 다시 로그인해 주세요." },
      { status: 401 }
    );
  }

  console.info("[POST /api/tasks] inserting", {
    titleLen: title.length,
    status,
    priority,
    dueDate,
    assigneeUserId,
    tagsCount: tagsForDb.length,
    createdByUserId
  });

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const posRes = await client.query<{ max: string | null }>(
      taskDepartmentId == null
        ? `SELECT MAX(position)::text AS max FROM tasks WHERE status = $1 AND department_id IS NULL`
        : `SELECT MAX(position)::text AS max FROM tasks WHERE status = $1 AND department_id = $2::uuid`,
      taskDepartmentId == null ? [status] : [status, taskDepartmentId]
    );
    const nextPos = posRes.rows[0].max != null ? Number(posRes.rows[0].max) + 1 : 0;

    const insert = await client.query<TaskRow>(
      `
      INSERT INTO tasks (
        title, description, status, priority, due_date, assignee_user_id, tags, position, department_id, created_by
      )
      VALUES ($1, $2, $3, $4, $5::date, $6::uuid, $7::text[], $8, $9::uuid, $10::uuid)
      RETURNING
        id, title, description, status, priority, due_date::text, assignee_user_id,
        tags, position, department_id::text, created_by, created_at, updated_at
      `,
      [
        title,
        description,
        status,
        priority,
        dueDate,
        assigneeUserId,
        tagsForDb,
        nextPos,
        taskDepartmentId,
        createdByUserId
      ]
    );

    const row = insert.rows[0];
    const nameRes = await client.query<{ name: string | null }>(
      `SELECT name FROM users WHERE id = $1::uuid`,
      [row.assignee_user_id]
    );
    await client.query("COMMIT");

    console.info("[POST /api/tasks] success", { taskId: row.id });
    broadcastNavBadgesRefresh();
    if (assigneeUserId && assigneeUserId !== createdByUserId) {
      emitSocketToUser(assigneeUserId, "task:assigned", {
        taskId: row.id,
        title: row.title
      });
    }
    await createActivityLogSafe({
      userId: session.sub,
      actionType: "task_created",
      entityType: "task",
      entityId: row.id,
      entityName: row.title,
      departmentId: row.department_id,
      metadata: {
        status: row.status,
        priority: row.priority,
        url: "/tasks"
      }
    });

    return NextResponse.json({
      task: mapRow({
        ...row,
        assignee_name: nameRes.rows[0]?.name ?? null,
        is_new: row.status !== "done"
      } as TaskRow)
    });
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      logPostTasksFailure("ROLLBACK failed after error", rollbackErr);
    }
    logPostTasksFailure("INSERT transaction failed", e, {
      titleLen: title.length,
      status,
      assigneeUserId,
      tagsSample: tagsForDb.slice(0, 5),
      createdByUserId
    });
    return NextResponse.json({ message: "태스크를 저장하지 못했습니다." }, { status: 500 });
  } finally {
    client.release();
  }
}
