import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isChannelHost } from "@/lib/chat-permissions";
import { CHANNEL_ACCESS_PREDICATE } from "@/lib/channel-access";
import { getSessionFromRequest } from "@/lib/session";
import { getUserContext } from "@/lib/user-context";

type RouteCtx = { params: { id: string } };

export async function DELETE(_request: NextRequest, context: RouteCtx) {
  const session = getSessionFromRequest(_request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const ctx = await getUserContext(session.sub);
  if (!ctx) {
    return NextResponse.json({ message: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  const { id: channelId } = context.params;

  const ch = await db.query<{ kind: string }>(`SELECT kind FROM channels WHERE id = $1::uuid`, [channelId]);
  const kind = ch.rows[0]?.kind;
  if (!kind) {
    return NextResponse.json({ message: "찾을 수 없습니다." }, { status: 404 });
  }

  if (kind !== "group_dm" && kind !== "cross_team") {
    return NextResponse.json({ message: "삭제할 수 없는 채널 유형입니다." }, { status: 400 });
  }

  const acc = await db.query<{ ok: boolean }>(
    `
    SELECT TRUE AS ok
    FROM channels c
    INNER JOIN users u ON u.id = $1::uuid
    WHERE c.id = $2::uuid AND ${CHANNEL_ACCESS_PREDICATE}
    LIMIT 1
    `,
    [session.sub, channelId]
  );
  if (!acc.rows[0]?.ok) {
    return NextResponse.json({ message: "접근할 수 없습니다." }, { status: 403 });
  }

  const allowed =
    ctx.role === "admin" || ctx.role === "manager" || (await isChannelHost(session.sub, channelId));
  if (!allowed) {
    return NextResponse.json({ message: "호스트만 채널을 삭제할 수 있습니다." }, { status: 403 });
  }

  await db.query(`DELETE FROM channels WHERE id = $1::uuid`, [channelId]);
  return NextResponse.json({ ok: true });
}
