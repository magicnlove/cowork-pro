export type ActivityActionType =
  | "message_sent"
  | "task_created"
  | "task_moved"
  | "task_completed"
  | "note_created"
  | "note_updated"
  | "file_uploaded"
  | "event_created"
  | "member_joined"
  | "document_viewed"
  | "document_created"
  | "document_updated"
  | "document_version_created"
  | "document_approved"
  | "document_archived"
  | "workspace_member_role_changed";

export type ActivityEntityType =
  | "channel"
  | "task"
  | "note"
  | "event"
  | "file"
  | "document"
  | "workspace";

export type ActivityFilter =
  | "all"
  | "chat"
  | "task"
  | "note"
  | "file"
  | "calendar"
  | "document";

export type ActivityItemDTO = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  actionType: ActivityActionType;
  entityType: ActivityEntityType;
  entityId: string;
  entityName: string;
  departmentId: string | null;
  departmentName: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  link: string;
  /** 삭제 API 호출 가능 여부 (UI에서 버튼 표시) */
  canDelete?: boolean;
};

