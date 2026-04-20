import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getVisibleDepartmentIds } from "@/lib/org-scope";
import { getSessionFromRequest } from "@/lib/session";
import { getUserContext } from "@/lib/user-context";

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const ctx = await getUserContext(session.sub);
  if (!ctx) {
    return NextResponse.json({ message: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  const departmentId = request.nextUrl.searchParams.get("departmentId")?.trim();
  if (!departmentId) {
    return NextResponse.json({ message: "departmentId가 필요합니다." }, { status: 400 });
  }

  if (ctx.role !== "admin") {
    const scope = await getVisibleDepartmentIds(ctx);
    if (!scope.includes(departmentId)) {
      return NextResponse.json({ message: "접근할 수 없는 부서입니다." }, { status: 403 });
    }
  }

  const res = await db.query<{ id: string; name: string; email: string }>(
    `
    SELECT u.id::text, u.name, u.email
    FROM users u
    INNER JOIN user_departments ud ON ud.user_id = u.id
    WHERE ud.department_id = $1::uuid
    ORDER BY u.name ASC
    `,
    [departmentId]
  );

  return NextResponse.json({
    users: res.rows.map((r) => ({ id: r.id, name: r.name, email: r.email }))
  });
}
