import { db } from "@/lib/db";
import { getVisibleDepartmentIds } from "@/lib/org-scope";
import type { UserContext } from "@/lib/user-context";

export async function canAccessMeetingNote(ctx: UserContext, departmentId: string): Promise<boolean> {
  if (ctx.role === "admin") {
    return true;
  }
  const scope = await getVisibleDepartmentIds(ctx);
  return scope.includes(departmentId);
}

export async function getMeetingNoteDepartmentId(noteId: string): Promise<string | null> {
  const r = await db.query<{ department_id: string }>(
    `SELECT department_id::text FROM meeting_notes WHERE id = $1::uuid`,
    [noteId]
  );
  return r.rows[0]?.department_id ?? null;
}
