export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canPinMessage } from "@/lib/chat-permissions";
import { CHANNEL_ACCESS_PREDICATE } from "@/lib/channel-access";
import { getSessionFromRequest } from "@/lib/session";
import { getUserContext } from "@/lib/user-context";

type RouteCtx = { params: { pinId: string } };

export async function DELETE(_request: NextRequest, context: RouteCtx) {
  const session = getSessionFromRequest(_request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const ctx = await getUserContext(session.sub);
  if (!ctx) {
    return NextResponse.json({ message: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  const { pinId } = context.params;

  const pin = await db.query<{ channel_id: string }>(
    `SELECT channel_id::text FROM channel_pinned_messages WHERE id = $1::uuid`,
    [pinId]
  );
  const cid = pin.rows[0]?.channel_id;
  if (!cid) {
    return NextResponse.json({ message: "찾을 수 없습니다." }, { status: 404 });
  }

  const ch = await db.query<{ kind: string }>(`SELECT kind FROM channels WHERE id = $1::uuid`, [cid]);
  const kind = ch.rows[0]?.kind ?? "";

  const acc = await db.query<{ ok: boolean }>(
    `
    SELECT TRUE AS ok
    FROM channels c
    INNER JOIN users u ON u.id = $1::uuid
    WHERE c.id = $2::uuid AND ${CHANNEL_ACCESS_PREDICATE}
    LIMIT 1
    `,
    [session.sub, cid]
  );
  if (!acc.rows[0]?.ok) {
    return NextResponse.json({ message: "접근할 수 없습니다." }, { status: 403 });
  }

  if (!(await canPinMessage(ctx, cid, kind))) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }

  await db.query(`DELETE FROM channel_pinned_messages WHERE id = $1::uuid`, [pinId]);
  return NextResponse.json({ ok: true });
}
