export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { denyUnlessAdmin } from "@/lib/require-admin";
import { getSessionFromRequest } from "@/lib/session";
import { getUserContext } from "@/lib/user-context";

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const ctx = await getUserContext(session.sub);
  const denied = denyUnlessAdmin(ctx);
  if (denied) {
    return denied;
  }

  const res = await db.query<{
    id: string;
    user_id: string;
    status: string;
    created_at: Date;
    user_email: string;
    user_name: string;
  }>(
    `
    SELECT
      r.id::text,
      r.user_id::text,
      r.status,
      r.created_at,
      u.email AS user_email,
      u.name AS user_name
    FROM password_reset_requests r
    INNER JOIN users u ON u.id = r.user_id
    ORDER BY r.created_at DESC
    LIMIT 200
    `
  );

  return NextResponse.json({
    requests: res.rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      status: r.status,
      createdAt: r.created_at.toISOString(),
      userEmail: r.user_email,
      userName: r.user_name
    }))
  });
}
