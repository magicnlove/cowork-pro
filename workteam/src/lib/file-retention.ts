import { db } from "@/lib/db";
import { deleteStoredFile } from "@/lib/file-storage";
import type { FileEntityType } from "@/types/files";

export function getFilesRetentionDays(): number {
  const n = Number(process.env.RETENTION_FILES_DAYS);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

export function isEntityTypeSubjectToRetention(entityType: FileEntityType): boolean {
  return entityType === "chat_message" || entityType === "task";
}

/** 미팅노트 첨부 외 chat/task 첨부만 보존 기간 적용 */
export function isAttachmentExpired(row: { entity_type: FileEntityType; created_at: Date }): boolean {
  if (!isEntityTypeSubjectToRetention(row.entity_type)) {
    return false;
  }
  const days = getFilesRetentionDays();
  const cutoff = new Date(row.created_at);
  cutoff.setDate(cutoff.getDate() + days);
  return Date.now() > cutoff.getTime();
}

export async function runFileRetentionCleanup(): Promise<{ filesDeleted: number }> {
  const days = getFilesRetentionDays();
  const client = await db.connect();
  let filesDeleted = 0;
  const storageKeys: string[] = [];
  try {
    await client.query("BEGIN");
    const sel = await client.query<{ id: string; storage_key: string }>(
      `
      SELECT id::text, storage_key
      FROM file_attachments
      WHERE entity_type IN ('chat_message', 'task')
        AND created_at < (NOW() - ($1::int * INTERVAL '1 day'))
      `,
      [days]
    );
    if (sel.rows.length === 0) {
      await client.query(`INSERT INTO cleanup_logs (files_deleted) VALUES (0)`);
      await client.query("COMMIT");
      return { filesDeleted: 0 };
    }
    const ids = sel.rows.map((r) => r.id);
    const del = await client.query<{ storage_key: string }>(
      `
      DELETE FROM file_attachments
      WHERE id = ANY($1::uuid[])
      RETURNING storage_key
      `,
      [ids]
    );
    filesDeleted = del.rows.length;
    for (const r of del.rows) {
      storageKeys.push(r.storage_key);
    }
    await client.query(`INSERT INTO cleanup_logs (files_deleted) VALUES ($1)`, [filesDeleted]);
    await client.query("COMMIT");
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }

  await Promise.all(storageKeys.map((k) => deleteStoredFile(k)));
  return { filesDeleted };
}
