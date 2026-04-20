import type { WorkspaceRole } from "@/types/archive";

export const ROLE_LABEL: Record<WorkspaceRole, string> = {
  viewer: "보기",
  editor: "편집",
  owner: "소유자"
};
