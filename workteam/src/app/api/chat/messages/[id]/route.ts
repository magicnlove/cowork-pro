export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { CHANNEL_ACCESS_PREDICATE } from "@/lib/channel-access";
import {
  hydrateMessageDto,
  loadReactionSummaries,
  type MessageRowDb
} from "@/lib/chat-message-utils";
import { broadcastToChatChannel } from "@/lib/chat-socket-broadcast";
import { deleteAttachmentsForEntity } from "@/lib/file-attachments";
import { deleteStoredFile } from "@/lib/file-storage";
import { getSessionFromRequest } from "@/lib/session";

const patchSchema = z.object({
  body: z.string().min(1).max(10000)
});

type RouteCtx = { params: { id: string } };

async function ensureAccess(userId: string, channelId: string) {
  const res = await db.query<{ ok: boolean }>(
    `
    SELECT TRUE AS ok
    FROM channels c
    INNER JOIN users u ON u.id = $1::uuid
    WHERE c.id = $2::uuid AND ${CHANNEL_ACCESS_PREDICATE}
    LIMIT 1
    `,
    [userId, channelId]
  );
  return Boolean(res.rows[0]?.ok);
}

export async function PATCH(request: NextRequest, context: RouteCtx) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id: messageId } = context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "잘못된 JSON입니다." }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "입력값이 올바르지 않습니다." }, { status: 400 });
  }

  const ex = await db.query<{ channel_id: string; user_id: string; deleted_at: Date | null }>(
    `SELECT channel_id::text, user_id::text, deleted_at FROM messages WHERE id = $1::uuid`,
    [messageId]
  );
  const row = ex.rows[0];
  if (!row) {
    return NextResponse.json({ message: "찾을 수 없습니다." }, { status: 404 });
  }
  if (row.deleted_at) {
    return NextResponse.json({ message: "삭제된 메시지는 수정할 수 없습니다." }, { status: 400 });
  }
  if (row.user_id !== session.sub) {
    return NextResponse.json({ message: "본인 메시지만 수정할 수 있습니다." }, { status: 403 });
  }
  if (!(await ensureAccess(session.sub, row.channel_id))) {
    return NextResponse.json({ message: "접근할 수 없습니다." }, { status: 403 });
  }

  await db.query(
    `
    UPDATE messages
    SET body = $1, edited_at = NOW()
    WHERE id = $2::uuid
    `,
    [parsed.data.body, messageId]
  );

  const msg = await db.query<MessageRowDb>(
    `
    SELECT
      m.id,
      m.channel_id::text,
      m.user_id::text,
      m.parent_message_id::text,
      m.body,
      m.created_at,
      m.edited_at,
      m.deleted_at,
      u.name AS user_name,
      u.email AS user_email
    FROM messages m
    JOIN users u ON u.id = m.user_id
    WHERE m.id = $1::uuid
    `,
    [messageId]
  );
  const rrow = msg.rows[0];
  const rx = await loadReactionSummaries([messageId], session.sub);
  const dto = await hydrateMessageDto(rrow, rx.get(messageId) ?? [], session.sub);
  broadcastToChatChannel(dto.channelId, "chat:message:update", dto);
  return NextResponse.json({ message: dto });
}

export async function DELETE(_request: NextRequest, context: RouteCtx) {
  const session = getSessionFromRequest(_request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id: messageId } = context.params;

  const ex = await db.query<{ channel_id: string; user_id: string; deleted_at: Date | null }>(
    `SELECT channel_id::text, user_id::text, deleted_at FROM messages WHERE id = $1::uuid`,
    [messageId]
  );
  const row = ex.rows[0];
  if (!row) {
    return NextResponse.json({ message: "찾을 수 없습니다." }, { status: 404 });
  }
  if (row.deleted_at) {
    return NextResponse.json({ message: "이미 삭제되었습니다." }, { status: 400 });
  }
  if (row.user_id !== session.sub) {
    return NextResponse.json({ message: "본인 메시지만 삭제할 수 있습니다." }, { status: 403 });
  }
  if (!(await ensureAccess(session.sub, row.channel_id))) {
    return NextResponse.json({ message: "접근할 수 없습니다." }, { status: 403 });
  }

  const removed = await deleteAttachmentsForEntity("chat_message", messageId);
  for (const att of removed) {
    await deleteStoredFile(att.storage_key);
  }

  await db.query(`UPDATE messages SET deleted_at = NOW() WHERE id = $1::uuid`, [messageId]);

  const msg = await db.query<MessageRowDb>(
    `
    SELECT
      m.id,
      m.channel_id::text,
      m.user_id::text,
      m.parent_message_id::text,
      m.body,
      m.created_at,
      m.edited_at,
      m.deleted_at,
      u.name AS user_name,
      u.email AS user_email
    FROM messages m
    JOIN users u ON u.id = m.user_id
    WHERE m.id = $1::uuid
    `,
    [messageId]
  );
  const rrow = msg.rows[0];
  const rx = await loadReactionSummaries([messageId], session.sub);
  const dto = await hydrateMessageDto(rrow, rx.get(messageId) ?? [], session.sub);
  broadcastToChatChannel(dto.channelId, "chat:message:update", dto);
  return NextResponse.json({ message: dto });
}
