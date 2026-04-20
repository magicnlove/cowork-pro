import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CHANNEL_ACCESS_PREDICATE } from "@/lib/channel-access";
import { getSessionFromRequest } from "@/lib/session";
import type { PinnedMessageDTO } from "@/types/chat";

type RouteCtx = { params: { id: string } };

export async function GET(_request: NextRequest, context: RouteCtx) {
  const session = getSessionFromRequest(_request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id: channelId } = context.params;

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

  const res = await db.query<{
    pid: string;
    mid: string;
    body: string;
    user_name: string;
    created_at: Date;
  }>(
    `
    SELECT
      p.id::text AS pid,
      m.id::text AS mid,
      m.body,
      u.name AS user_name,
      m.created_at
    FROM channel_pinned_messages p
    JOIN messages m ON m.id = p.message_id AND m.deleted_at IS NULL
    JOIN users u ON u.id = m.user_id
    WHERE p.channel_id = $1::uuid
    ORDER BY p.created_at DESC
    `,
    [channelId]
  );

  const pins: PinnedMessageDTO[] = res.rows.map((r) => ({
    pinId: r.pid,
    messageId: r.mid,
    channelId,
    body: r.body,
    userName: r.user_name,
    createdAt: r.created_at.toISOString()
  }));

  return NextResponse.json({ pins });
}
