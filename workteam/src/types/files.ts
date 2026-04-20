export type FileEntityType = "chat_message" | "task" | "meeting_note" | "document";

export type FileAttachmentDTO = {
  id: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
  /** 상대 URL (동일 오리진) */
  url: string;
  /** 이미지(jpg/png) 썸네일·미리보기용과 동일 URL */
  previewUrl: string | null;
  isImage: boolean;
  /** chat/task 첨부가 보존 기간을 초과한 경우 */
  expired?: boolean;
};
