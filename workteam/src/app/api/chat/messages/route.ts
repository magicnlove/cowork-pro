import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { CHANNEL_ACCESS_PREDICATE } from "@/lib/channel-access";
import {
  hydrateMessageDto,
  loadReactionSummaries,
  rowToDto,
  type MessageRowDb
} from "@/lib/chat-message-utils";
import { insertAttachment, loadAttachmentsForMessages } from "@/lib/file-attachments";
import { broadcastToChatChannel } from "@/lib/chat-socket-broadcast";
import { extensionFromFilename, saveUploadedBuffer } from "@/lib/file-storage";
import { broadcastChatNotify, broadcastNavBadgesRefresh } from "@/lib/activity-socket-broadcast";
import { createActivityLogSafe } from "@/lib/activity-log";
import { getSessionFromRequest } from "@/lib/session";
import type { ChatMessageDTO } from "@/types/chat";

const uuidSchema = z.string().uuid();

async function canAccessChannel(userId: string, channelId: string): Promise<boolean> {
  const res = await db.query<{ ok: boolean }>(
    `
    SELECT TRUE AS ok
    FROM channels c
    INNER JOIN users u ON u.id = $1::uuid
    WHERE c.id = $2::uuid
      AND ${CHANNEL_ACCESS_PREDICATE}
    LIMIT 1
    `,
    [userId, channelId]
  );
  return Boolean(res.rows[0]?.ok);
}

async function rowsToDtos(rows: MessageRowDb[], userId: string): Promise<ChatMessageDTO[]> {
  const ids = rows.map((r) => r.id);
  const rxMap = await loadReactionSummaries(ids, userId);
  const attMap = await loadAttachmentsForMessages(ids);
  return rows.map((r) => rowToDto(r, rxMap.get(r.id) ?? [], attMap.get(r.id) ?? []));
}

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const channelId = request.nextUrl.searchParams.get("channelId");
  const threadRootId = request.nextUrl.searchParams.get("threadRootId");
  const aroundMessageId = request.nextUrl.searchParams.get("aroundMessageId");

  const parsedChannel = channelId ? uuidSchema.safeParse(channelId) : null;
  if (!parsedChannel?.success) {
    return NextResponse.json({ message: "channelId가 필요합니다." }, { status: 400 });
  }

  const allowed = await canAccessChannel(session.sub, parsedChannel.data);
  if (!allowed) {
    return NextResponse.json({ message: "채널에 접근할 수 없습니다." }, { status: 403 });
  }

  if (threadRootId) {
    const parsedThread = uuidSchema.safeParse(threadRootId);
    if (!parsedThread.success) {
      return NextResponse.json({ message: "threadRootId가 올바르지 않습니다." }, { status: 400 });
    }

    const result = await db.query<MessageRowDb>(
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
      WHERE m.channel_id = $1::uuid
        AND (m.id = $2::uuid OR m.parent_message_id = $2::uuid)
      ORDER BY m.created_at ASC
      `,
      [parsedChannel.data, parsedThread.data]
    );

    const messages = await rowsToDtos(result.rows, session.sub);
    return NextResponse.json({ messages });
  }

  if (aroundMessageId) {
    const parsedAround = uuidSchema.safeParse(aroundMessageId);
    if (!parsedAround.success) {
      return NextResponse.json({ message: "aroundMessageId가 올바르지 않습니다." }, { status: 400 });
    }

    const target = await db.query<{ id: string; created_at: Date; parent_message_id: string | null }>(
      `
      SELECT id::text, created_at, parent_message_id::text
      FROM messages
      WHERE id = $1::uuid AND channel_id = $2::uuid AND deleted_at IS NULL
      LIMIT 1
      `,
      [parsedAround.data, parsedChannel.data]
    );
    const t = target.rows[0];
    if (!t) {
      return NextResponse.json({ message: "대상 메시지를 찾을 수 없습니다." }, { status: 404 });
    }
    if (t.parent_message_id) {
      return NextResponse.json({ message: "스레드 답글 점프는 아직 지원하지 않습니다." }, { status: 400 });
    }

    const limitBefore = 30;
    const limitAfter = 30;
    const around = await db.query<MessageRowDb>(
      `
      WITH target AS (
        SELECT $1::uuid AS id, $2::timestamptz AS created_at
      ),
      before AS (
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
        JOIN target t ON TRUE
        WHERE m.channel_id = $3::uuid
          AND m.parent_message_id IS NULL
          AND m.deleted_at IS NULL
          AND (m.created_at < t.created_at OR (m.created_at = t.created_at AND m.id <= t.id))
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT $4
      ),
      after AS (
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
        JOIN target t ON TRUE
        WHERE m.channel_id = $3::uuid
          AND m.parent_message_id IS NULL
          AND m.deleted_at IS NULL
          AND (m.created_at > t.created_at OR (m.created_at = t.created_at AND m.id > t.id))
        ORDER BY m.created_at ASC, m.id ASC
        LIMIT $5
      )
      SELECT * FROM (
        SELECT * FROM before
        UNION ALL
        SELECT * FROM after
      ) x
      ORDER BY x.created_at ASC, x.id ASC
      `,
      [parsedAround.data, t.created_at, parsedChannel.data, limitBefore + 1, limitAfter]
    );

    const messages = await rowsToDtos(around.rows, session.sub);
    return NextResponse.json({ messages, focusMessageId: parsedAround.data });
  }

  const result = await db.query<MessageRowDb>(
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
    WHERE m.channel_id = $1::uuid AND m.parent_message_id IS NULL
    ORDER BY m.created_at ASC
    `,
    [parsedChannel.data]
  );

  const messages = await rowsToDtos(result.rows, session.sub);
  return NextResponse.json({ messages });
}

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const ctype = request.headers.get("content-type") ?? "";
  if (!ctype.includes("multipart/form-data")) {
    return NextResponse.json({ message: "multipart/form-data가 필요합니다." }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ message: "본문을 읽을 수 없습니다." }, { status: 400 });
  }

  const channelId = String(form.get("channelId") ?? "").trim();
  let body = String(form.get("body") ?? "").trim();
  const parentRaw = form.get("parentMessageId");
  const parentMessageId =
    typeof parentRaw === "string" && parentRaw.trim() ? parentRaw.trim() : null;
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);

  if (!uuidSchema.safeParse(channelId).success) {
    return NextResponse.json({ message: "channelId가 올바르지 않습니다." }, { status: 400 });
  }
  if (!body && files.length === 0) {
    return NextResponse.json({ message: "메시지 또는 파일이 필요합니다." }, { status: 400 });
  }
  if (body.length > 10000) {
    return NextResponse.json({ message: "메시지가 너무 깁니다." }, { status: 400 });
  }
  if (!(await canAccessChannel(session.sub, channelId))) {
    return NextResponse.json({ message: "채널에 접근할 수 없습니다." }, { status: 403 });
  }
  const channelInfoRes = await db.query<{ name: string; department_id: string | null }>(
    `SELECT name, department_id::text FROM channels WHERE id = $1::uuid LIMIT 1`,
    [channelId]
  );
  const channelInfo = channelInfoRes.rows[0];

  if (!body && files.length > 0) {
    body = "\u200b";
  }

  if (parentMessageId) {
    const parsedParent = uuidSchema.safeParse(parentMessageId);
    if (!parsedParent.success) {
      return NextResponse.json({ message: "thread가 올바르지 않습니다." }, { status: 400 });
    }
    const parentRes = await db.query<{ channel_id: string }>(
      `SELECT channel_id::text FROM messages WHERE id = $1::uuid LIMIT 1`,
      [parsedParent.data]
    );
    const parent = parentRes.rows[0];
    if (!parent || parent.channel_id !== channelId) {
      return NextResponse.json({ message: "스레드 메시지가 올바르지 않습니다." }, { status: 400 });
    }
  }

  const ins = await db.query<{ id: string }>(
    `
    INSERT INTO messages (channel_id, user_id, parent_message_id, body)
    VALUES ($1::uuid, $2::uuid, $3::uuid, $4)
    RETURNING id::text
    `,
    [channelId, session.sub, parentMessageId, body]
  );
  const messageId = ins.rows[0]!.id;

  try {
    for (const file of files) {
      const buf = Buffer.from(await file.arrayBuffer());
      if (extensionFromFilename(file.name) === "") {
        throw new Error("bad_ext");
      }
      const saved = await saveUploadedBuffer(buf, file.name);
      const att = await insertAttachment({
        entityType: "chat_message",
        entityId: messageId,
        uploadedBy: session.sub,
        originalName: file.name,
        storageKey: saved.storageKey,
        mimeType: saved.mimeType,
        byteSize: saved.byteSize
      });
      await createActivityLogSafe({
        userId: session.sub,
        actionType: "file_uploaded",
        entityType: "file",
        entityId: att.id,
        entityName: file.name,
        departmentId: channelInfo?.department_id ?? null,
        metadata: {
          parentEntityType: "chat_message",
          parentEntityId: messageId,
          parentEntityName: channelInfo?.name ?? "채널",
          url: "/chat"
        }
      });
    }
  } catch (e) {
    await db.query(`DELETE FROM messages WHERE id = $1::uuid`, [messageId]);
    const code = e instanceof Error ? e.message : "";
    if (code === "bad_ext" || code === "unsupported_type" || code === "too_large") {
      return NextResponse.json({ message: "파일을 첨부할 수 없습니다." }, { status: 400 });
    }
    console.error("[POST chat/messages]", e);
    return NextResponse.json({ message: "첨부 저장에 실패했습니다." }, { status: 500 });
  }

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
  const row = msg.rows[0];
  if (!row) {
    return NextResponse.json({ message: "저장 후 조회에 실패했습니다." }, { status: 500 });
  }
  const rx = await loadReactionSummaries([messageId], session.sub);
  const dto = await hydrateMessageDto(row, rx.get(messageId) ?? [], session.sub);
  const displayName =
    channelInfo?.name != null ? String(channelInfo.name).replace(/^#\s*/, "").trim() : "채팅";
  const enriched: ChatMessageDTO = { ...dto, channelDisplayName: displayName };
  broadcastToChatChannel(dto.channelId, "chat:message", enriched);
  broadcastChatNotify({
    channelId: dto.channelId,
    channelDisplayName: displayName,
    senderName: dto.userName,
    bodyPreview: String(dto.body ?? "")
      .replace(/\u200b/g, "")
      .trim()
      .slice(0, 50),
    authorUserId: dto.userId,
    messageId: dto.id,
    parentMessageId: dto.parentMessageId
  });
  broadcastNavBadgesRefresh();
  await createActivityLogSafe({
    userId: session.sub,
    actionType: "message_sent",
    entityType: "channel",
    entityId: channelId,
    entityName: channelInfo?.name ?? "채널",
    departmentId: channelInfo?.department_id ?? null,
    metadata: {
      messageId,
      parentMessageId,
      hasAttachment: files.length > 0,
      url: "/chat"
    }
  });
  return NextResponse.json({ message: dto });
}
