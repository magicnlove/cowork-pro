import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createActivityLogSafe } from "@/lib/activity-log";
import { db } from "@/lib/db";
import { insertAttachment, loadAttachmentsByEntity, mapRowToDto } from "@/lib/file-attachments";
import { assertCanUploadToEntity } from "@/lib/file-entity-guard";
import { extensionFromFilename, saveUploadedBuffer } from "@/lib/file-storage";
import { getSessionFromRequest } from "@/lib/session";
import type { FileEntityType } from "@/types/files";

const entityTypeSchema = z.enum(["chat_message", "task", "meeting_note", "document"]);

/** GET ?entityType=&entityId= 첨부 메타데이터 */
export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const entityType = entityTypeSchema.safeParse(searchParams.get("entityType"));
  const entityId = z.string().uuid().safeParse(searchParams.get("entityId"));
  if (!entityType.success || !entityId.success) {
    return NextResponse.json({ message: "entityType, entityId가 필요합니다." }, { status: 400 });
  }

  const allowed = await assertCanUploadToEntity(session.sub, entityType.data, entityId.data, {
    mode: "read"
  });
  if (!allowed) {
    return NextResponse.json({ message: "접근할 수 없습니다." }, { status: 403 });
  }

  const attachments = await loadAttachmentsByEntity(entityType.data, entityId.data);
  return NextResponse.json({ attachments });
}

/** multipart: file, entityType, entityId */
export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ message: "요청 본문을 읽을 수 없습니다." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ message: "파일이 필요합니다." }, { status: 400 });
  }

  const entityType = entityTypeSchema.safeParse(form.get("entityType"));
  const entityId = z.string().uuid().safeParse(form.get("entityId"));
  if (!entityType.success || !entityId.success) {
    return NextResponse.json({ message: "entityType, entityId가 올바르지 않습니다." }, { status: 400 });
  }

  const ok = await assertCanUploadToEntity(session.sub, entityType.data as FileEntityType, entityId.data);
  if (!ok) {
    return NextResponse.json({ message: "첨부할 권한이 없습니다." }, { status: 403 });
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ message: "파일을 읽을 수 없습니다." }, { status: 400 });
  }

  if (extensionFromFilename(file.name) === "") {
    return NextResponse.json({ message: "파일 확장자가 필요합니다." }, { status: 400 });
  }

  let saved: { storageKey: string; mimeType: string; byteSize: number };
  try {
    saved = await saveUploadedBuffer(buffer, file.name);
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    if (code === "too_large") {
      return NextResponse.json({ message: "파일이 너무 큽니다." }, { status: 400 });
    }
    if (code === "unsupported_type") {
      return NextResponse.json({ message: "허용되지 않은 형식입니다." }, { status: 400 });
    }
    console.error("[POST /api/files]", e);
    return NextResponse.json({ message: "저장하지 못했습니다." }, { status: 500 });
  }

  const row = await insertAttachment({
    entityType: entityType.data as FileEntityType,
    entityId: entityId.data,
    uploadedBy: session.sub,
    originalName: file.name,
    storageKey: saved.storageKey,
    mimeType: saved.mimeType,
    byteSize: saved.byteSize
  });
  let departmentId: string | null = null;
  let entityName = file.name;
  if (entityType.data === "task") {
    const t = await db.query<{ title: string; department_id: string | null }>(
      `SELECT title, department_id::text FROM tasks WHERE id = $1::uuid LIMIT 1`,
      [entityId.data]
    );
    entityName = t.rows[0]?.title ?? entityName;
    departmentId = t.rows[0]?.department_id ?? null;
  } else if (entityType.data === "meeting_note") {
    const n = await db.query<{ title: string; department_id: string | null }>(
      `SELECT title, department_id::text FROM meeting_notes WHERE id = $1::uuid LIMIT 1`,
      [entityId.data]
    );
    entityName = n.rows[0]?.title ?? entityName;
    departmentId = n.rows[0]?.department_id ?? null;
  } else if (entityType.data === "document") {
    const d = await db.query<{ title: string; workspace_id: string }>(
      `SELECT title, workspace_id::text FROM documents WHERE id = $1::uuid LIMIT 1`,
      [entityId.data]
    );
    entityName = d.rows[0]?.title ?? entityName;
    const ws = d.rows[0]?.workspace_id;
    await createActivityLogSafe({
      userId: session.sub,
      actionType: "file_uploaded",
      entityType: "file",
      entityId: row.id,
      entityName: file.name,
      departmentId: null,
      metadata: {
        parentEntityType: "document",
        parentEntityId: entityId.data,
        parentEntityName: entityName,
        url: ws ? `/archive/${ws}/${entityId.data}` : "/archive"
      }
    });
    return NextResponse.json({ attachment: mapRowToDto(row) });
  } else {
    const m = await db.query<{ channel_id: string }>(
      `SELECT channel_id::text FROM messages WHERE id = $1::uuid LIMIT 1`,
      [entityId.data]
    );
    if (m.rows[0]?.channel_id) {
      const c = await db.query<{ name: string; department_id: string | null }>(
        `SELECT name, department_id::text FROM channels WHERE id = $1::uuid LIMIT 1`,
        [m.rows[0].channel_id]
      );
      entityName = c.rows[0]?.name ?? entityName;
      departmentId = c.rows[0]?.department_id ?? null;
    }
  }
  await createActivityLogSafe({
    userId: session.sub,
    actionType: "file_uploaded",
    entityType: "file",
    entityId: row.id,
    entityName: file.name,
    departmentId,
    metadata: {
      parentEntityType: entityType.data,
      parentEntityId: entityId.data,
      parentEntityName: entityName,
      url:
        entityType.data === "task"
          ? "/tasks"
          : entityType.data === "meeting_note"
            ? `/meeting-notes?id=${encodeURIComponent(entityId.data)}`
            : "/chat"
    }
  });

  return NextResponse.json({ attachment: mapRowToDto(row) });
}

