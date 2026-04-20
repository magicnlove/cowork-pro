import { db } from "@/lib/db";
import type { UserContext } from "@/lib/user-context";

/** admin이 아닐 때: 본인이 볼 수 있는 부서 id (member=본인, manager=본인+하위) */
export async function getVisibleDepartmentIds(ctx: UserContext): Promise<string[]> {
  if (ctx.role === "admin") {
    return [];
  }
  const assigned = ctx.departments.map((d) => d.id);
  if (ctx.role === "member") {
    return assigned;
  }

  const managerRootIds = ctx.departments.filter((d) => d.role === "manager").map((d) => d.id);
  const set = new Set<string>(assigned);
  if (managerRootIds.length === 0) {
    return [...set];
  }
  const res = await db.query<{ id: string }>(
    `
    WITH RECURSIVE sub AS (
      SELECT id
      FROM departments
      WHERE id = ANY($1::uuid[])
      UNION ALL
      SELECT d.id
      FROM departments d
      INNER JOIN sub ON d.parent_id = sub.id
    )
    SELECT DISTINCT id::text FROM sub
    `,
    [managerRootIds]
  );
  for (const row of res.rows) {
    set.add(row.id);
  }
  return [...set];
}

/** 이벤트 'team' 등에서 department_id가 사용자 스코프에 들어가는지 */
export async function isDepartmentIdInScope(
  ctx: UserContext,
  departmentId: string | null
): Promise<boolean> {
  if (ctx.role === "admin") {
    return true;
  }
  if (!departmentId) {
    return false;
  }
  const scope = await getVisibleDepartmentIds(ctx);
  return scope.includes(departmentId);
}
