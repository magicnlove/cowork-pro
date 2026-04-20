import { db } from "@/lib/db";
import { isAttachmentExpired } from "@/lib/file-retention";
import type { FileAttachmentDTO } from "@/types/files";
import type { FileEntityType } from "@/types/files";

export type AttachmentRow = {
  id: string;
  entity_type: FileEntityType;
  entity_id: string;
  uploaded_by: string | null;
  original_name: string;
  storage_key: string;
  mime_type: string;
  byte_size: string;
  created_at: Date;
};

export function mapRowToDto(row: AttachmentRow): FileAttachmentDTO {
  const isImage = row.mime_type.startsWith("image/");
  const expired = isAttachmentExpired(row);
  return {
    id: row.id,
    originalName: row.original_name,
    mimeType: row.mime_type,
    byteSize: Number(row.byte_size),
    url: `/api/files/${row.id}`,
    previewUrl: isImage && !expired ? `/api/files/${row.id}?inline=1` : null,
    isImage,
    expired: expired ? true : undefined
  };
}

export async function loadAttachmentsByEntity(
  entityType: FileEntityType,
  entityId: string
): Promise<FileAttachmentDTO[]> {
  const res = await db.query<AttachmentRow>(
    `
    SELECT
      id::text,
      entity_type,
      entity_id::text,
      uploaded_by::text,
      original_name,
      storage_key,
      mime_type,
      byte_size::text,
      created_at
    FROM file_attachments
    WHERE entity_type = $1 AND entity_id = $2::uuid
    ORDER BY created_at ASC
    `,
    [entityType, entityId]
  );
  return res.rows.map(mapRowToDto);
}

export async function loadAttachmentsForMessages(
  messageIds: string[]
): Promise<Map<string, FileAttachmentDTO[]>> {
  const map = new Map<string, FileAttachmentDTO[]>();
  if (messageIds.length === 0) {
    return map;
  }
  const res = await db.query<AttachmentRow>(
    `
    SELECT
      id::text,
      entity_type,
      entity_id::text,
      uploaded_by::text,
      original_name,
      storage_key,
      mime_type,
      byte_size::text,
      created_at
    FROM file_attachments
    WHERE entity_type = 'chat_message' AND entity_id = ANY($1::uuid[])
    ORDER BY created_at ASC
    `,
    [messageIds]
  );
  for (const row of res.rows) {
    const mid = row.entity_id;
    const dto = mapRowToDto(row);
    const arr = map.get(mid) ?? [];
    arr.push(dto);
    map.set(mid, arr);
  }
  return map;
}

export async function insertAttachment(input: {
  entityType: FileEntityType;
  entityId: string;
  uploadedBy: string;
  originalName: string;
  storageKey: string;
  mimeType: string;
  byteSize: number;
}): Promise<AttachmentRow> {
  const ins = await db.query<AttachmentRow>(
    `
    INSERT INTO file_attachments (
      entity_type, entity_id, uploaded_by, original_name, storage_key, mime_type, byte_size
    )
    VALUES ($1, $2::uuid, $3::uuid, $4, $5, $6, $7)
    RETURNING
      id::text,
      entity_type,
      entity_id::text,
      uploaded_by::text,
      original_name,
      storage_key,
      mime_type,
      byte_size::text,
      created_at
    `,
    [
      input.entityType,
      input.entityId,
      input.uploadedBy,
      input.originalName,
      input.storageKey,
      input.mimeType,
      input.byteSize
    ]
  );
  return ins.rows[0]!;
}

export async function getAttachmentById(id: string): Promise<AttachmentRow | null> {
  const r = await db.query<AttachmentRow>(
    `
    SELECT
      id::text,
      entity_type,
      entity_id::text,
      uploaded_by::text,
      original_name,
      storage_key,
      mime_type,
      byte_size::text,
      created_at
    FROM file_attachments
    WHERE id = $1::uuid
    LIMIT 1
    `,
    [id]
  );
  return r.rows[0] ?? null;
}

export async function deleteAttachmentRow(id: string): Promise<AttachmentRow | null> {
  const r = await db.query<AttachmentRow>(
    `
    DELETE FROM file_attachments
    WHERE id = $1::uuid
    RETURNING
      id::text,
      entity_type,
      entity_id::text,
      uploaded_by::text,
      original_name,
      storage_key,
      mime_type,
      byte_size::text,
      created_at
    `,
    [id]
  );
  return r.rows[0] ?? null;
}

export async function deleteAttachmentsForEntity(entityType: FileEntityType, entityId: string): Promise<
  AttachmentRow[]
> {
  const r = await db.query<AttachmentRow>(
    `
    DELETE FROM file_attachments
    WHERE entity_type = $1 AND entity_id = $2::uuid
    RETURNING
      id::text,
      entity_type,
      entity_id::text,
      uploaded_by::text,
      original_name,
      storage_key,
      mime_type,
      byte_size::text,
      created_at
    `,
    [entityType, entityId]
  );
  return r.rows;
}
