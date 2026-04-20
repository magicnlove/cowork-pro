import { db } from "@/lib/db";

export type WorkspaceCardSummary = {
  id: string;
  name: string;
  type: string;
  documentCount: number;
  memberCount: number;
  lastActivityAt: string | null;
};

export type RecentModifiedDoc = {
  id: string;
  title: string;
  workspaceId: string;
  workspaceName: string;
  modifiedAt: string;
};

export async function getWorkspaceCardSummaries(userId: string): Promise<WorkspaceCardSummary[]> {
  const res = await db.query<{
    id: string;
    name: string;
    type: string;
    document_count: string;
    member_count: string;
    last_activity_at: Date | null;
  }>(
    `
    SELECT
      w.id::text,
      w.name,
      w.type,
      (SELECT COUNT(*)::text FROM documents d WHERE d.workspace_id = w.id) AS document_count,
      (SELECT COUNT(*)::text FROM workspace_members wm2 WHERE wm2.workspace_id = w.id) AS member_count,
      COALESCE(
        (SELECT MAX(dv.created_at) FROM document_versions dv
         INNER JOIN documents d ON d.id = dv.document_id
         WHERE d.workspace_id = w.id),
        w.created_at
      ) AS last_activity_at
    FROM workspaces w
    INNER JOIN workspace_members me ON me.workspace_id = w.id AND me.user_id = $1::uuid
    ORDER BY last_activity_at DESC NULLS LAST
    `,
    [userId]
  );
  return res.rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    documentCount: Number.parseInt(r.document_count, 10) || 0,
    memberCount: Number.parseInt(r.member_count, 10) || 0,
    lastActivityAt: r.last_activity_at ? r.last_activity_at.toISOString() : null
  }));
}

export async function getRecentModifiedDocuments(userId: string, limit: number): Promise<RecentModifiedDoc[]> {
  const res = await db.query<{
    id: string;
    title: string;
    workspace_id: string;
    workspace_name: string;
    modified_at: Date;
  }>(
    `
    SELECT
      d.id::text,
      d.title,
      d.workspace_id::text,
      w.name AS workspace_name,
      COALESCE(
        (SELECT MAX(dv.created_at) FROM document_versions dv WHERE dv.document_id = d.id),
        d.created_at
      ) AS modified_at
    FROM documents d
    INNER JOIN workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = $1::uuid
    INNER JOIN workspaces w ON w.id = d.workspace_id
    ORDER BY modified_at DESC
    LIMIT $2::int
    `,
    [userId, limit]
  );
  return res.rows.map((r) => ({
    id: r.id,
    title: r.title,
    workspaceId: r.workspace_id,
    workspaceName: r.workspace_name,
    modifiedAt: r.modified_at.toISOString()
  }));
}
