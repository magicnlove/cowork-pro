import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import {
  assertCanDeleteAttachment,
  assertCanAccessAttachmentForRead
} from "@/lib/file-entity-guard";
import { deleteAttachmentRow, getAttachmentById } from "@/lib/file-attachments";
import { isAttachmentExpired } from "@/lib/file-retention";
import { absolutePathFromStorageKey, deleteStoredFile } from "@/lib/file-storage";
import { getSessionFromRequest } from "@/lib/session";

type RouteCtx = { params: { id: string } };

export async function GET(request: NextRequest, context: RouteCtx) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = context.params;
  const row = await getAttachmentById(id);
  if (!row) {
    return NextResponse.json({ message: "찾을 수 없습니다." }, { status: 404 });
  }

  const can = await assertCanAccessAttachmentForRead(session.sub, row);
  if (!can) {
    return NextResponse.json({ message: "접근할 수 없습니다." }, { status: 403 });
  }

  if (isAttachmentExpired(row)) {
    return NextResponse.json({ message: "다운로드 유효기간이 지났습니다." }, { status: 410 });
  }

  const inline = request.nextUrl.searchParams.get("inline") === "1";
  const isImage = row.mime_type.startsWith("image/");
  const disposition = inline && isImage ? "inline" : "attachment";

  let body: Buffer;
  try {
    body = await fs.readFile(absolutePathFromStorageKey(row.storage_key));
  } catch {
    return NextResponse.json({ message: "파일을 찾을 수 없습니다." }, { status: 404 });
  }

  const encoded = encodeURIComponent(row.original_name);
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": row.mime_type,
      "Content-Length": String(body.length),
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encoded}`
    }
  });
}

export async function DELETE(_request: NextRequest, context: RouteCtx) {
  const session = getSessionFromRequest(_request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = context.params;
  const row = await getAttachmentById(id);
  if (!row) {
    return NextResponse.json({ message: "찾을 수 없습니다." }, { status: 404 });
  }

  const can = await assertCanDeleteAttachment(session.sub, row);
  if (!can) {
    return NextResponse.json({ message: "삭제할 권한이 없습니다." }, { status: 403 });
  }

  const deleted = await deleteAttachmentRow(id);
  if (deleted) {
    await deleteStoredFile(deleted.storage_key);
  }

  return NextResponse.json({ ok: true });
}
