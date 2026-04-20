import { getVisibleDepartmentIds } from "@/lib/org-scope";
import type { UserContext } from "@/lib/user-context";

export async function canUserAccessTask(
  ctx: UserContext,
  task: { departmentId: string | null; createdBy: string | null }
): Promise<boolean> {
  if (ctx.role === "admin") {
    return true;
  }
  if (task.departmentId) {
    const scope = await getVisibleDepartmentIds(ctx);
    return scope.includes(task.departmentId);
  }
  return task.createdBy === ctx.id;
}
