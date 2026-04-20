import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOnlineUserIds } from "@/lib/activity-presence";
import { getVisibleDepartmentIds } from "@/lib/org-scope";
import { getSessionFromRequest } from "@/lib/session";
import { getUserContext } from "@/lib/user-context";

export async function GET(_request: NextRequest) {
  const session = getSessionFromRequest(_request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const ctx = await getUserContext(session.sub);
  if (!ctx) {
    return NextResponse.json({ message: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  const onlineIds = getOnlineUserIds();
  if (onlineIds.length === 0) {
    return NextResponse.json({ users: [] });
  }

  const whereParts: string[] = [`u.id = ANY($1::uuid[])`];
  const params: unknown[] = [onlineIds];
  let p = 2;
  if (ctx.role !== "admin") {
    const scope = await getVisibleDepartmentIds(ctx);
    whereParts.push(`EXISTS (
      SELECT 1
      FROM user_departments uds
      WHERE uds.user_id = u.id
        AND uds.department_id = ANY($${p}::uuid[])
    )`);
    params.push(scope);
    p += 1;
  }

  const res = await db.query<{
    id: string;
    name: string;
    email: string;
    department_name: string | null;
  }>(
    `
    SELECT
      u.id::text,
      u.name,
      u.email,
      d.name AS department_name
    FROM users u
    LEFT JOIN LATERAL (
      SELECT ud.department_id
      FROM user_departments ud
      WHERE ud.user_id = u.id
      ORDER BY ud.is_primary DESC, ud.created_at ASC
      LIMIT 1
    ) pud ON TRUE
    LEFT JOIN departments d ON d.id = pud.department_id
    WHERE ${whereParts.join(" AND ")}
    ORDER BY u.name ASC
    LIMIT 200
    `,
    params
  );
  return NextResponse.json({
    users: res.rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      departmentName: r.department_name
    }))
  });
}

