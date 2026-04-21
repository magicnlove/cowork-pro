export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getVisibleDepartmentIds } from "@/lib/org-scope";
import { getSessionFromRequest } from "@/lib/session";
import { getUserContext } from "@/lib/user-context";

/** 부서명·사용자 이름/이메일 부분 일치 검색 (아카이브 멤버 추가용) */
export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const ctx = await getUserContext(session.sub);
  if (!ctx) {
    return NextResponse.json({ message: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) {
    return NextResponse.json({ departments: [], users: [] });
  }
  const like = `%${q}%`;

  if (ctx.role === "admin") {
    const deptRes = await db.query<{ id: string; name: string }>(
      `
      SELECT id::text, name
      FROM departments
      WHERE name ILIKE $1
      ORDER BY name ASC
      LIMIT 20
      `,
      [like]
    );
    const userRes = await db.query<{ id: string; name: string; email: string }>(
      `
      SELECT id::text, name, email
      FROM users
      WHERE name ILIKE $1 OR email ILIKE $1
      ORDER BY name ASC
      LIMIT 25
      `,
      [like]
    );
    return NextResponse.json({
      departments: deptRes.rows.map((r) => ({ id: r.id, name: r.name })),
      users: userRes.rows.map((r) => ({ id: r.id, name: r.name, email: r.email }))
    });
  }

  const scope = await getVisibleDepartmentIds(ctx);
  if (scope.length === 0) {
    return NextResponse.json({ departments: [], users: [] });
  }

  const deptRes = await db.query<{ id: string; name: string }>(
    `
    SELECT id::text, name
    FROM departments
    WHERE id = ANY($1::uuid[])
      AND name ILIKE $2
    ORDER BY name ASC
    LIMIT 20
    `,
    [scope, like]
  );

  const userRes = await db.query<{ id: string; name: string; email: string }>(
    `
    SELECT DISTINCT u.id::text, u.name, u.email
    FROM users u
    INNER JOIN user_departments ud ON ud.user_id = u.id
    WHERE ud.department_id = ANY($1::uuid[])
      AND (u.name ILIKE $2 OR u.email ILIKE $2)
    ORDER BY u.name ASC
    LIMIT 25
    `,
    [scope, like]
  );

  return NextResponse.json({
    departments: deptRes.rows.map((r) => ({ id: r.id, name: r.name })),
    users: userRes.rows.map((r) => ({ id: r.id, name: r.name, email: r.email }))
  });
}
