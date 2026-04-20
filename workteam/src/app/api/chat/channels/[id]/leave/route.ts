import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isChannelHost } from "@/lib/chat-permissions";
import { CHANNEL_ACCESS_PREDICATE } from "@/lib/channel-access";
import { getSessionFromRequest } from "@/lib/session";

type RouteCtx = { params: { id: string } };

export async function POST(_request: NextRequest, context: RouteCtx) {
  const session = getSessionFromRequest(_request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id: channelId } = context.params;

  const ch = await db.query<{ kind: string }>(`SELECT kind FROM channels WHERE id = $1::uuid`, [channelId]);
  const kind = ch.rows[0]?.kind;
  if (kind !== "group_dm" && kind !== "cross_team") {
    return NextResponse.json({ message: "이 채널에서는 나가기를 지원하지 않습니다." }, { status: 400 });
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

  if (await isChannelHost(session.sub, channelId)) {
    return NextResponse.json(
      { message: "호스트는 채팅방을 삭제하거나, 다른 호스트에게 위임한 뒤 나갈 수 있습니다." },
      { status: 400 }
    );
  }

  await db.query(
    `DELETE FROM channel_members WHERE channel_id = $1::uuid AND user_id = $2::uuid`,
    [channelId, session.sub]
  );

  return NextResponse.json({ ok: true });
}
