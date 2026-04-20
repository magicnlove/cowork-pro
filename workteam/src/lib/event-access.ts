import { getVisibleDepartmentIds } from "@/lib/org-scope";
import type { UserContext } from "@/lib/user-context";

type EventScopeRow = {
  kind: string;
  department_id: string | null;
  created_by: string | null;
  attendee_user_ids: string[] | null;
};

export async function canUserSeeEvent(ctx: UserContext, row: EventScopeRow): Promise<boolean> {
  if (row.kind === "announcement") {
    return true;
  }
  if (row.kind === "personal") {
    if (row.created_by === ctx.id) {
      return true;
    }
    const ids = row.attendee_user_ids ?? [];
    return ids.includes(ctx.id);
  }
  if (row.kind === "team") {
    if (!row.department_id) {
      return ctx.role === "admin";
    }
    if (ctx.role === "admin") {
      return true;
    }
    const scope = await getVisibleDepartmentIds(ctx);
    return scope.includes(row.department_id);
  }
  return false;
}

export function canUserEditEvent(ctx: UserContext, createdBy: string | null): boolean {
  if (ctx.role === "admin") {
    return true;
  }
  return createdBy != null && createdBy === ctx.id;
}
