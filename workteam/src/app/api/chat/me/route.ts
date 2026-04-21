export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/session";

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  is_temp_password: boolean;
  departments: Array<{
    departmentId: string;
    departmentName: string;
    isPrimary: boolean;
    role: "admin" | "manager" | "member";
  }>;
};

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const result = await db.query<UserRow>(
    `
    SELECT
      u.id::text,
      u.email,
      u.name,
      u.role,
      u.is_temp_password,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'departmentId', ud.department_id::text,
            'departmentName', d.name,
            'isPrimary', ud.is_primary,
            'role', ud.role
          )
          ORDER BY ud.is_primary DESC, d.name ASC
        ) FILTER (WHERE ud.id IS NOT NULL),
        '[]'::json
      ) AS departments
    FROM users u
    LEFT JOIN user_departments ud ON ud.user_id = u.id
    LEFT JOIN departments d ON d.id = ud.department_id
    WHERE u.id = $1::uuid
    GROUP BY u.id, u.email, u.name, u.role, u.is_temp_password
    LIMIT 1
    `,
    [session.sub]
  );
  const user = result.rows[0];
  if (!user) {
    return NextResponse.json({ message: "사용자를 찾을 수 없습니다." }, { status: 404 });
  }

  const primary =
    user.departments.find((d) => d.isPrimary) ?? user.departments[0] ?? null;
  const secondaryDepartments = user.departments.filter((d) => !d.isPrimary);

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      departmentId: primary?.departmentId ?? null,
      departmentName: primary?.departmentName ?? null,
      departmentRole: primary?.role ?? null,
      isTempPassword: user.is_temp_password,
      secondaryDepartments
    }
  });
}
