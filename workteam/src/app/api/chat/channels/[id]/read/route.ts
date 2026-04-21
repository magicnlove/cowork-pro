export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CHANNEL_ACCESS_PREDICATE } from "@/lib/channel-access";
import { getSessionFromRequest } from "@/lib/session";

type RouteCtx = { params: { id: string } };

async function canAccess(userId: string, channelId: string) {
  const res = await db.query<{ ok: boolean }>(
    `
    SELECT TRUE AS ok
    FROM channels c
    INNER JOIN users u ON u.id = $1::uuid
    WHERE c.id = $2::uuid AND ${CHANNEL_ACCESS_PREDICATE}
    LIMIT 1
    `,
    [userId, channelId]
  );
  return Boolean(res.rows[0]?.ok);
}

export async function POST(_request: NextRequest, context: RouteCtx) {
  const session = getSessionFromRequest(_request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id: channelId } = context.params;
  if (!(await canAccess(session.sub, channelId))) {
    return NextResponse.json({ message: "채널에 접근할 수 없습니다." }, { status: 403 });
  }

  const latest = await db.query<{ t: Date }>(
    `
    SELECT MAX(created_at) AS t
    FROM messages
    WHERE channel_id = $1::uuid AND parent_message_id IS NULL
    `,
    [channelId]
  );
  const ts = latest.rows[0]?.t ?? new Date();

  await db.query(
    `
    INSERT INTO channel_reads (user_id, channel_id, last_read_at)
    VALUES ($1::uuid, $2::uuid, $3::timestamptz)
    ON CONFLICT (user_id, channel_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at
    `,
    [session.sub, channelId, ts]
  );

  return NextResponse.json({ ok: true });
}
