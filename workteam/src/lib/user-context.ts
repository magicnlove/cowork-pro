import { db } from "@/lib/db";
import { getUserDepartmentAssignments } from "@/lib/user-departments";

export type OrgRole = "admin" | "manager" | "member";

export type UserContext = {
  id: string;
  email: string;
  name: string;
  role: OrgRole;
  departmentId: string | null;
  departmentName: string | null;
  departments: Array<{
    id: string;
    name: string;
    isPrimary: boolean;
    role: "admin" | "manager" | "member";
  }>;
};

export async function getUserContext(userId: string): Promise<UserContext | null> {
  if (!userId || userId === "undefined") {
    return null;
  }
  const res = await db.query<{
    id: string;
    email: string;
    name: string;
    role: string;
  }>(
    `
    SELECT
      u.id::text,
      u.email,
      u.name,
      u.role
    FROM users u
    WHERE u.id = $1::uuid
    LIMIT 1
    `,
    [userId]
  );
  const row = res.rows[0];
  if (!row) {
    return null;
  }
  const departmentsRaw = await getUserDepartmentAssignments(userId);
  const primary = departmentsRaw.find((d) => d.isPrimary) ?? departmentsRaw[0] ?? null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as OrgRole,
    departmentId: primary?.departmentId ?? null,
    departmentName: primary?.departmentName ?? null,
    departments: departmentsRaw.map((d) => ({
      id: d.departmentId,
      name: d.departmentName,
      isPrimary: d.isPrimary,
      role: d.role
    }))
  };
}
