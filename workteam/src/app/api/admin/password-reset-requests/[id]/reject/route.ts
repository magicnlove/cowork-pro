export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { denyUnlessAdmin } from "@/lib/require-admin";
import { getSessionFromRequest } from "@/lib/session";
import { getUserContext } from "@/lib/user-context";

type RouteCtx = { params: { id: string } };

export async function POST(request: NextRequest, context: RouteCtx) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const ctx = await getUserContext(session.sub);
  const denied = denyUnlessAdmin(ctx);
  if (denied) {
    return denied;
  }

  const requestId = context.params.id;

  const res = await db.query<{ id: string }>(
    `
    UPDATE password_reset_requests
    SET status = 'rejected'
    WHERE id = $1::uuid AND status = 'pending'
    RETURNING id::text
    `,
    [requestId]
  );

  if (res.rowCount === 0) {
    return NextResponse.json({ message: "거절할 수 있는 요청이 없습니다." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
