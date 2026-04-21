export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getVisibleDepartmentIds } from "@/lib/org-scope";
import { getSessionFromRequest } from "@/lib/session";
import { getUserContext } from "@/lib/user-context";

/** 로그인 사용자가 일정·참고용으로 볼 수 있는 부서 목록 */
export async function GET(_request: NextRequest) {
  const session = getSessionFromRequest(_request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const ctx = await getUserContext(session.sub);
  if (!ctx) {
    return NextResponse.json({ message: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  if (ctx.role === "admin") {
    const res = await db.query<{
      id: string;
      name: string;
      code: string;
      parent_id: string | null;
      depth: number;
      sort_order: number;
    }>(
      `
      SELECT id::text, name, code, parent_id::text, depth, sort_order
      FROM departments
      ORDER BY depth ASC, sort_order ASC, name ASC
      `
    );
    return NextResponse.json({ departments: res.rows });
  }

  const scope = await getVisibleDepartmentIds(ctx);
  if (scope.length === 0) {
    return NextResponse.json({ departments: [] });
  }

  const res = await db.query<{
    id: string;
    name: string;
    code: string;
    parent_id: string | null;
    depth: number;
    sort_order: number;
  }>(
    `
    SELECT id::text, name, code, parent_id::text, depth, sort_order
    FROM departments
    WHERE id = ANY($1::uuid[])
    ORDER BY depth ASC, sort_order ASC, name ASC
    `,
    [scope]
  );
  return NextResponse.json({ departments: res.rows });
}
