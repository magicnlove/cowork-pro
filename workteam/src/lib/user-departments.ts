import { db } from "@/lib/db";

export type UserDepartmentAssignment = {
  id: string;
  userId: string;
  departmentId: string;
  departmentName: string;
  isPrimary: boolean;
  role: "admin" | "manager" | "member";
};

export async function getUserDepartmentAssignments(userId: string): Promise<UserDepartmentAssignment[]> {
  const res = await db.query<{
    id: string;
    user_id: string;
    department_id: string;
    department_name: string;
    is_primary: boolean;
    role: "admin" | "manager" | "member";
  }>(
    `
    SELECT
      ud.id::text,
      ud.user_id::text,
      ud.department_id::text,
      d.name AS department_name,
      ud.is_primary,
      ud.role
    FROM user_departments ud
    INNER JOIN departments d ON d.id = ud.department_id
    WHERE ud.user_id = $1::uuid
    ORDER BY ud.is_primary DESC, d.name ASC
    `,
    [userId]
  );
  return res.rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    departmentId: r.department_id,
    departmentName: r.department_name,
    isPrimary: r.is_primary,
    role: r.role
  }));
}

export async function getPrimaryDepartmentAssignment(
  userId: string
): Promise<UserDepartmentAssignment | null> {
  const res = await db.query<{
    id: string;
    user_id: string;
    department_id: string;
    department_name: string;
    is_primary: boolean;
    role: "admin" | "manager" | "member";
  }>(
    `
    SELECT
      ud.id::text,
      ud.user_id::text,
      ud.department_id::text,
      d.name AS department_name,
      ud.is_primary,
      ud.role
    FROM user_departments ud
    INNER JOIN departments d ON d.id = ud.department_id
    WHERE ud.user_id = $1::uuid
    ORDER BY ud.is_primary DESC, ud.created_at ASC
    LIMIT 1
    `,
    [userId]
  );
  const row = res.rows[0];
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    userId: row.user_id,
    departmentId: row.department_id,
    departmentName: row.department_name,
    isPrimary: row.is_primary,
    role: row.role
  };
}

