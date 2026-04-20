import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/session";

type UserRow = {
  id: string;
  name: string;
  email: string;
  department_id: string | null;
  department_name: string | null;
  department_path: string | null;
};

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const departmentId = request.nextUrl.searchParams.get("departmentId")?.trim() ?? "";
  const pattern =
    q.length > 0 ? `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%` : null;
  const hasDepartmentFilter = /^[0-9a-fA-F-]{36}$/.test(departmentId);

  const result = await db.query<UserRow>(
    pattern
      ? `
        WITH RECURSIVE dept_path AS (
          SELECT d.id, d.name::text AS path
          FROM departments d
          WHERE d.parent_id IS NULL
          UNION ALL
          SELECT c.id, (p.path || ' > ' || c.name)::text
          FROM departments c
          INNER JOIN dept_path p ON p.id = c.parent_id
        )
        SELECT
          u.id,
          u.name,
          u.email,
          pud.department_id::text AS department_id,
          d.name AS department_name,
          dp.path AS department_path
        FROM users u
        LEFT JOIN LATERAL (
          SELECT ud.department_id
          FROM user_departments ud
          WHERE ud.user_id = u.id
          ORDER BY ud.is_primary DESC, ud.created_at ASC
          LIMIT 1
        ) pud ON TRUE
        LEFT JOIN departments d ON d.id = pud.department_id
        LEFT JOIN dept_path dp ON dp.id = pud.department_id
        WHERE
          u.name ILIKE $1 ESCAPE '\\'
          OR u.email ILIKE $1 ESCAPE '\\'
          OR COALESCE(d.name, '') ILIKE $1 ESCAPE '\\'
          OR COALESCE(dp.path, '') ILIKE $1 ESCAPE '\\'
          ${hasDepartmentFilter ? "OR pud.department_id = $2::uuid" : ""}
        ORDER BY u.name ASC
        LIMIT 300
      `
      : `
        WITH RECURSIVE dept_path AS (
          SELECT d.id, d.name::text AS path
          FROM departments d
          WHERE d.parent_id IS NULL
          UNION ALL
          SELECT c.id, (p.path || ' > ' || c.name)::text
          FROM departments c
          INNER JOIN dept_path p ON p.id = c.parent_id
        )
        SELECT
          u.id,
          u.name,
          u.email,
          pud.department_id::text AS department_id,
          d.name AS department_name,
          dp.path AS department_path
        FROM users u
        LEFT JOIN LATERAL (
          SELECT ud.department_id
          FROM user_departments ud
          WHERE ud.user_id = u.id
          ORDER BY ud.is_primary DESC, ud.created_at ASC
          LIMIT 1
        ) pud ON TRUE
        LEFT JOIN departments d ON d.id = pud.department_id
        LEFT JOIN dept_path dp ON dp.id = pud.department_id
        ${hasDepartmentFilter ? "WHERE pud.department_id = $1::uuid" : ""}
        ORDER BY u.name ASC
        LIMIT 500
      `,
    pattern
      ? hasDepartmentFilter
        ? [pattern, departmentId]
        : [pattern]
      : hasDepartmentFilter
        ? [departmentId]
        : []
  );

  return NextResponse.json({
    users: result.rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      departmentId: u.department_id,
      departmentName: u.department_name,
      departmentPath: u.department_path
    }))
  });
}
