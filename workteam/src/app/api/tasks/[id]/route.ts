export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { broadcastNavBadgesRefresh } from "@/lib/activity-socket-broadcast";
import { db } from "@/lib/db";
import { createActivityLogSafe } from "@/lib/activity-log";
import { emitSocketToUser } from "@/lib/user-socket-broadcast";
import { deleteAttachmentsForEntity } from "@/lib/file-attachments";
import { deleteStoredFile } from "@/lib/file-storage";
import { canUserAccessTask } from "@/lib/task-access";
import { moveTask } from "@/lib/task-move";
import { getSessionFromRequest } from "@/lib/session";
import { getUserContext } from "@/lib/user-context";
import type { TaskPriority, TaskStatus } from "@/types/tasks";

const taskStatusSchema = z.enum(["backlog", "in_progress", "in_review", "done"]);
const prioritySchema = z.enum(["high", "medium", "low"]);

const patchBodySchema = z
  .object({
    title: z.string().min(1).max(500).optional(),
    description: z.string().nullable().optional(),
    status: taskStatusSchema.optional(),
    priority: prioritySchema.optional(),
    dueDate: z.string().nullable().optional(),
    assigneeUserId: z.string().uuid().nullable().optional(),
    tags: z.array(z.string().max(40)).max(20).optional(),
    moveTo: z
      .object({
        status: taskStatusSchema,
        index: z.number().int().min(0)
      })
      .optional()
  })
  .strict();

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

async function fetchTaskWithAssignee(id: string, viewerUserId: string): Promise<TaskRow | null> {
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
        t.assignee_user_id = $2::uuid
        AND t.status <> 'done'
        AND (utr.read_at IS NULL OR t.updated_at > utr.read_at)
      ) AS is_new
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assignee_user_id
    LEFT JOIN user_task_reads utr ON utr.task_id = t.id AND utr.user_id = $2::uuid
    WHERE t.id = $1
    `,
    [id, viewerUserId]
  );
  return result.rows[0] ?? null;
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
  const row = await fetchTaskWithAssignee(id, session.sub);
  if (!row) {
    return NextResponse.json({ message: "찾을 수 없습니다." }, { status: 404 });
  }
  if (
    !(await canUserAccessTask(ctx, {
      departmentId: row.department_id,
      createdBy: row.created_by
    }))
  ) {
    return NextResponse.json({ message: "접근 권한이 없습니다." }, { status: 403 });
  }
  return NextResponse.json({ task: mapRow(row) });
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

  const existing = await fetchTaskWithAssignee(id, session.sub);
  if (!existing) {
    return NextResponse.json({ message: "찾을 수 없습니다." }, { status: 404 });
  }
  if (
    !(await canUserAccessTask(ctx, {
      departmentId: existing.department_id,
      createdBy: existing.created_by
    }))
  ) {
    return NextResponse.json({ message: "접근 권한이 없습니다." }, { status: 403 });
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

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    let touched = false;

    if (data.moveTo) {
      await moveTask(client, id, data.moveTo.status, data.moveTo.index);
      touched = true;
    }

    if (data.status !== undefined && !data.moveTo) {
      const cur = await client.query<{ status: string }>(
        `SELECT status FROM tasks WHERE id = $1 FOR UPDATE`,
        [id]
      );
      if (cur.rowCount === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ message: "찾을 수 없습니다." }, { status: 404 });
      }
      if (cur.rows[0].status !== data.status) {
        const dest = await client.query<{ c: string }>(
          existing.department_id == null
            ? `SELECT COUNT(*)::text AS c FROM tasks WHERE status = $1 AND id <> $2 AND department_id IS NULL`
            : `SELECT COUNT(*)::text AS c FROM tasks WHERE status = $1 AND id <> $2 AND department_id = $3::uuid`,
          existing.department_id == null
            ? [data.status, id]
            : [data.status, id, existing.department_id]
        );
        const idx = Number(dest.rows[0].c);
        await moveTask(client, id, data.status, idx);
        touched = true;
      }
    }

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
    if (data.priority !== undefined) {
      fields.push(`priority = $${pn++}`);
      values.push(data.priority);
    }
    if (data.dueDate !== undefined) {
      fields.push(`due_date = $${pn++}::date`);
      values.push(data.dueDate);
    }
    if (data.assigneeUserId !== undefined) {
      fields.push(`assignee_user_id = $${pn++}::uuid`);
      values.push(data.assigneeUserId);
    }
    if (data.tags !== undefined) {
      fields.push(`tags = $${pn++}::text[]`);
      values.push(data.tags);
    }

    if (fields.length > 0) {
      fields.push("updated_at = NOW()");
      values.push(id);
      await client.query(
        `UPDATE tasks SET ${fields.join(", ")} WHERE id = $${pn}::uuid`,
        values
      );
      touched = true;
    }

    if (!touched) {
      await client.query("ROLLBACK");
      return NextResponse.json({ message: "변경할 내용이 없습니다." }, { status: 400 });
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    if (e instanceof Error && e.message === "NOT_FOUND") {
      return NextResponse.json({ message: "찾을 수 없습니다." }, { status: 404 });
    }
    console.error(e);
    return NextResponse.json({ message: "저장하지 못했습니다." }, { status: 500 });
  } finally {
    client.release();
  }

  const row = await fetchTaskWithAssignee(id, session.sub);
  if (!row) {
    return NextResponse.json({ message: "찾을 수 없습니다." }, { status: 404 });
  }

  broadcastNavBadgesRefresh();
  if (
    data.assigneeUserId !== undefined &&
    row.assignee_user_id &&
    row.assignee_user_id !== existing.assignee_user_id &&
    row.assignee_user_id !== session.sub
  ) {
    emitSocketToUser(row.assignee_user_id, "task:assigned", {
      taskId: row.id,
      title: row.title
    });
  }

  const oldStatus = existing.status;
  const newStatus = row.status;
  if (newStatus !== oldStatus || Boolean(data.moveTo)) {
    await createActivityLogSafe({
      userId: session.sub,
      actionType: newStatus === "done" && oldStatus !== "done" ? "task_completed" : "task_moved",
      entityType: "task",
      entityId: row.id,
      entityName: row.title,
      departmentId: row.department_id,
      metadata: {
        fromStatus: oldStatus,
        toStatus: newStatus,
        url: "/tasks"
      }
    });
  }
  return NextResponse.json({ task: mapRow(row) });
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
  const row = await fetchTaskWithAssignee(id, session.sub);
  if (!row) {
    return NextResponse.json({ message: "찾을 수 없습니다." }, { status: 404 });
  }
  if (
    !(await canUserAccessTask(ctx, {
      departmentId: row.department_id,
      createdBy: row.created_by
    }))
  ) {
    return NextResponse.json({ message: "접근 권한이 없습니다." }, { status: 403 });
  }

  const removed = await deleteAttachmentsForEntity("task", id);
  for (const att of removed) {
    await deleteStoredFile(att.storage_key);
  }

  const result = await db.query(`DELETE FROM tasks WHERE id = $1 RETURNING id`, [id]);
  if (result.rowCount === 0) {
    return NextResponse.json({ message: "찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
