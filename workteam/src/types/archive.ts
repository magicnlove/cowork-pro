export type WorkspaceType = "org" | "custom";

export type WorkspaceRole = "viewer" | "editor" | "owner";

/** 루트: in_progress | completed | reference, 선택적으로 한 단계 하위만 허용 */
export type DocumentFolderRoot = "in_progress" | "completed" | "reference";

export type AuditAction =
  | "document_viewed"
  | "document_created"
  | "document_updated"
  | "document_version_created"
  | "workspace_member_role_changed"
  | "workspace_member_removed";

export type WorkspaceDTO = {
  id: string;
  name: string;
  type: WorkspaceType;
  createdBy: string;
  createdAt: string;
  myRole: WorkspaceRole;
};

export type DocumentDTO = {
  id: string;
  title: string;
  workspaceId: string;
  folder: string;
  createdBy: string;
  createdAt: string;
};

export type DocumentDetailDTO = DocumentDTO & {
  body: string;
  editor: {
    /** 편집기 URL은 서버에서 환경변수 기반으로만 생성. 파일 직접 URL 없음. */
    embedUrl: string | null;
  };
  myRole: WorkspaceRole;
};

export type DocumentVersionDTO = {
  id: string;
  documentId: string;
  versionNumber: number;
  changeSummary: string | null;
  body: string;
  createdBy: string;
  createdAt: string;
};

export type DocumentCommentDTO = {
  id: string;
  documentId: string;
  userId: string;
  userName: string;
  userEmail: string;
  content: string;
  createdAt: string;
};

export type AuditLogDTO = {
  id: string;
  userId: string;
  userName: string;
  action: string;
  targetId: string | null;
  timestamp: string;
};
