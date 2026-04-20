import { db } from "@/lib/db";
import type { WorkspaceRole } from "@/types/archive";

const ROLE_RANK: Record<WorkspaceRole, number> = {
  viewer: 1,
  editor: 2,
  owner: 3
};

export function workspaceRoleAtLeast(role: WorkspaceRole | null, min: WorkspaceRole): boolean {
  if (!role) {
    return false;
  }
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export async function getWorkspaceRole(
  userId: string,
  workspaceId: string
): Promise<WorkspaceRole | null> {
  const res = await db.query<{ role: WorkspaceRole }>(
    `
    SELECT role
    FROM workspace_members
    WHERE workspace_id = $1::uuid AND user_id = $2::uuid
    LIMIT 1
    `,
    [workspaceId, userId]
  );
  return res.rows[0]?.role ?? null;
}

export async function listWorkspaceIdsForUser(userId: string): Promise<string[]> {
  const res = await db.query<{ id: string }>(
    `
    SELECT workspace_id::text AS id
    FROM workspace_members
    WHERE user_id = $1::uuid
    `,
    [userId]
  );
  return res.rows.map((r) => r.id);
}

export async function assertWorkspaceAccess(
  userId: string,
  workspaceId: string
): Promise<WorkspaceRole> {
  const role = await getWorkspaceRole(userId, workspaceId);
  if (!role) {
    throw new AccessError(403, "워크스페이스에 접근할 수 없습니다.");
  }
  return role;
}

export async function requireWorkspaceRole(
  userId: string,
  workspaceId: string,
  min: WorkspaceRole
): Promise<WorkspaceRole> {
  const role = await assertWorkspaceAccess(userId, workspaceId);
  if (!workspaceRoleAtLeast(role, min)) {
    throw new AccessError(403, "이 작업을 수행할 권한이 없습니다.");
  }
  return role;
}

export class AccessError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "AccessError";
  }
}

export async function getDocumentWorkspaceId(documentId: string): Promise<string | null> {
  const res = await db.query<{ workspace_id: string }>(
    `SELECT workspace_id::text FROM documents WHERE id = $1::uuid LIMIT 1`,
    [documentId]
  );
  return res.rows[0]?.workspace_id ?? null;
}

export async function assertDocumentAccess(
  userId: string,
  documentId: string,
  minRole: WorkspaceRole
): Promise<{ role: WorkspaceRole; workspaceId: string }> {
  const ws = await getDocumentWorkspaceId(documentId);
  if (!ws) {
    throw new AccessError(404, "문서를 찾을 수 없습니다.");
  }
  const role = await getWorkspaceRole(userId, ws);
  if (!workspaceRoleAtLeast(role, minRole)) {
    throw new AccessError(403, "이 작업을 수행할 권한이 없습니다.");
  }
  return { role: role!, workspaceId: ws };
}
