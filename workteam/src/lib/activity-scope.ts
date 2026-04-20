import { db } from "@/lib/db";
import { getVisibleDepartmentIds } from "@/lib/org-scope";
import type { UserContext } from "@/lib/user-context";

export async function canUserViewActivityLog(
  ctx: UserContext,
  row: {
    department_id: string | null;
    user_id: string;
    entity_type?: string | null;
    entity_id?: string | null;
  }
): Promise<boolean> {
  if (ctx.role === "admin") {
    return true;
  }
  if (row.entity_type === "document" && row.entity_id) {
    const res = await db.query(
      `
      SELECT 1 AS ok
      FROM documents d
      INNER JOIN workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = $1::uuid
      WHERE d.id = $2::uuid
      LIMIT 1
      `,
      [ctx.id, row.entity_id]
    );
    return Boolean(res.rows[0]);
  }
  if (row.entity_type === "workspace" && row.entity_id) {
    const res = await db.query(
      `
      SELECT 1 AS ok
      FROM workspace_members wm
      WHERE wm.workspace_id = $1::uuid AND wm.user_id = $2::uuid
      LIMIT 1
      `,
      [row.entity_id, ctx.id]
    );
    return Boolean(res.rows[0]);
  }
  const scope = await getVisibleDepartmentIds(ctx);
  if (row.department_id && scope.includes(row.department_id)) {
    return true;
  }
  if (!row.department_id && row.user_id === ctx.id) {
    return true;
  }
  return false;
}

export function canUserDeleteActivityLog(ctx: UserContext, actorUserId: string): boolean {
  return ctx.role === "admin" || ctx.id === actorUserId;
}
