import { db } from "@/lib/db";
import { loadAttachmentsForMessages } from "@/lib/file-attachments";
import type { ChatMessageDTO, MessageReactionSummary } from "@/types/chat";
import type { FileAttachmentDTO } from "@/types/files";

export type MessageRowDb = {
  id: string;
  channel_id: string;
  user_id: string;
  parent_message_id: string | null;
  body: string;
  created_at: Date;
  edited_at: Date | null;
  deleted_at: Date | null;
  user_name: string;
  user_email: string;
};

export async function loadReactionSummaries(
  messageIds: string[],
  currentUserId: string
): Promise<Map<string, MessageReactionSummary[]>> {
  const map = new Map<string, MessageReactionSummary[]>();
  if (messageIds.length === 0) {
    return map;
  }
  const res = await db.query<{
    message_id: string;
    emoji: string;
    cnt: string;
    self: boolean;
  }>(
    `
    SELECT
      message_id::text,
      emoji,
      COUNT(*)::text AS cnt,
      BOOL_OR(user_id = $1::uuid) AS self
    FROM message_reactions
    WHERE message_id = ANY($2::uuid[])
    GROUP BY message_id, emoji
    ORDER BY emoji
    `,
    [currentUserId, messageIds]
  );
  for (const row of res.rows) {
    const arr = map.get(row.message_id) ?? [];
    arr.push({
      emoji: row.emoji,
      count: Number(row.cnt),
      self: row.self
    });
    map.set(row.message_id, arr);
  }
  return map;
}

export function rowToDto(
  row: MessageRowDb,
  reactions: MessageReactionSummary[],
  attachments: FileAttachmentDTO[] = []
): ChatMessageDTO {
  return {
    id: row.id,
    channelId: row.channel_id,
    userId: row.user_id,
    parentMessageId: row.parent_message_id,
    body: row.body,
    createdAt: row.created_at.toISOString(),
    editedAt: row.edited_at ? row.edited_at.toISOString() : null,
    deletedAt: row.deleted_at ? row.deleted_at.toISOString() : null,
    userName: row.user_name,
    userEmail: row.user_email,
    reactions,
    attachments
  };
}

export async function hydrateMessageDto(
  row: MessageRowDb,
  reactions: MessageReactionSummary[],
  userId: string
): Promise<ChatMessageDTO> {
  const att = await loadAttachmentsForMessages([row.id]);
  return rowToDto(row, reactions, att.get(row.id) ?? []);
}
