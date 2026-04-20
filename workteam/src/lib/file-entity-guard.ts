import { db } from "@/lib/db";
import { assertDocumentAccess } from "@/lib/archive-scope";
import { CHANNEL_ACCESS_PREDICATE } from "@/lib/channel-access";
import { canUserAccessTask } from "@/lib/task-access";
import { canAccessMeetingNote, getMeetingNoteDepartmentId } from "@/lib/meeting-note-access";
import type { AttachmentRow } from "@/lib/file-attachments";
import { getUserContext } from "@/lib/user-context";
import type { FileEntityType } from "@/types/files";

export async function assertCanAccessAttachmentForRead(userId: string, row: AttachmentRow): Promise<boolean> {
  const ctx = await getUserContext(userId);
  if (!ctx) {
    return false;
  }
  if (ctx.role === "admin") {
    return true;
  }
  if (row.entity_type === "chat_message") {
    const ok = await db.query<{ ok: boolean }>(
      `
      SELECT TRUE AS ok
      FROM file_attachments fa
      INNER JOIN messages m ON m.id = fa.entity_id AND fa.entity_type = 'chat_message'
      INNER JOIN channels c ON c.id = m.channel_id
      INNER JOIN users u ON u.id = $1::uuid
      WHERE fa.id = $2::uuid AND ${CHANNEL_ACCESS_PREDICATE}
      LIMIT 1
      `,
      [userId, row.id]
    );
    return Boolean(ok.rows[0]?.ok);
  }
  if (row.entity_type === "task") {
    const t = await db.query<{ department_id: string | null; created_by: string | null }>(
      `SELECT department_id::text, created_by::text FROM tasks WHERE id = $1::uuid`,
      [row.entity_id]
    );
    const task = t.rows[0];
    if (!task) {
      return false;
    }
    return canUserAccessTask(ctx, {
      departmentId: task.department_id,
      createdBy: task.created_by
    });
  }
  if (row.entity_type === "meeting_note") {
    const d = await getMeetingNoteDepartmentId(row.entity_id);
    if (!d) {
      return false;
    }
    return canAccessMeetingNote(ctx, d);
  }
  if (row.entity_type === "document") {
    try {
      await assertDocumentAccess(userId, row.entity_id, "viewer");
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export async function assertCanUploadToEntity(
  userId: string,
  entityType: FileEntityType,
  entityId: string,
  opts?: { mode?: "read" | "write" }
): Promise<boolean> {
  const ctx = await getUserContext(userId);
  if (!ctx) {
    return false;
  }
  if (entityType === "chat_message") {
    const ok = await db.query<{ ok: boolean }>(
      `
      SELECT TRUE AS ok
      FROM messages m
      INNER JOIN channels c ON c.id = m.channel_id
      INNER JOIN users u ON u.id = $1::uuid
      WHERE m.id = $2::uuid AND ${CHANNEL_ACCESS_PREDICATE}
      LIMIT 1
      `,
      [userId, entityId]
    );
    return Boolean(ok.rows[0]?.ok);
  }
  if (entityType === "task") {
    const t = await db.query<{ department_id: string | null; created_by: string | null }>(
      `SELECT department_id::text, created_by::text FROM tasks WHERE id = $1::uuid`,
      [entityId]
    );
    const task = t.rows[0];
    if (!task) {
      return false;
    }
    return canUserAccessTask(ctx, {
      departmentId: task.department_id,
      createdBy: task.created_by
    });
  }
  if (entityType === "meeting_note") {
    const d = await getMeetingNoteDepartmentId(entityId);
    if (!d) {
      return false;
    }
    return canAccessMeetingNote(ctx, d);
  }
  if (entityType === "document") {
    const min = opts?.mode === "read" ? "viewer" : "editor";
    try {
      await assertDocumentAccess(userId, entityId, min);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export async function assertCanDeleteAttachment(userId: string, row: AttachmentRow): Promise<boolean> {
  const ctx = await getUserContext(userId);
  if (!ctx) {
    return false;
  }
  if (ctx.role === "admin") {
    return true;
  }
  if (row.uploaded_by === userId) {
    const canRead = await assertCanAccessAttachmentForRead(userId, row);
    return canRead;
  }
  return false;
}
