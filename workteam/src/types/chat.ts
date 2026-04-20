import type { FileAttachmentDTO } from "@/types/files";

export type ChatChannelRow = {
  id: string;
  slug: string;
  name: string;
  kind: "dm" | "company_wide" | "department" | "cross_team" | "group_dm";
};

export type MessageReactionSummary = {
  emoji: string;
  count: number;
  self: boolean;
};

export type ChatMessageDTO = {
  id: string;
  channelId: string;
  userId: string;
  parentMessageId: string | null;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  userName: string;
  userEmail: string;
  reactions: MessageReactionSummary[];
  attachments: FileAttachmentDTO[];
  /** Socket/HTTP 브로드캐스트 시에만 포함 — 채널 표시명 */
  channelDisplayName?: string;
};

export type PinnedMessageDTO = {
  pinId: string;
  messageId: string;
  channelId: string;
  body: string;
  userName: string;
  createdAt: string;
};
