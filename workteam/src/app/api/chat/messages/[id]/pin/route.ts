export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canPinMessage } from "@/lib/chat-permissions";
import { CHANNEL_ACCESS_PREDICATE } from "@/lib/channel-access";
import { getSessionFromRequest } from "@/lib/session";
import { getUserContext } from "@/lib/user-context";

type RouteCtx = { params: { id: string } };

export async function POST(_request: NextRequest, context: RouteCtx) {
  const session = getSessionFromRequest(_request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const ctx = await getUserContext(session.sub);
  if (!ctx) {
    return NextResponse.json({ message: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  const { id: messageId } = context.params;

  const msg = await db.query<{ channel_id: string; parent_message_id: string | null }>(
    `SELECT channel_id::text, parent_message_id::text FROM messages WHERE id = $1::uuid AND deleted_at IS NULL`,
    [messageId]
  );
  const m = msg.rows[0];
  if (!m) {
    return NextResponse.json({ message: "찾을 수 없습니다." }, { status: 404 });
  }
  if (m.parent_message_id) {
    return NextResponse.json({ message: "스레드 댓글은 고정할 수 없습니다." }, { status: 400 });
  }

  const ch = await db.query<{ kind: string }>(
    `SELECT kind FROM channels WHERE id = $1::uuid`,
    [m.channel_id]
  );
  const kind = ch.rows[0]?.kind;
  if (!kind) {
    return NextResponse.json({ message: "채널을 찾을 수 없습니다." }, { status: 404 });
  }

  const acc = await db.query<{ ok: boolean }>(
    `
    SELECT TRUE AS ok
    FROM channels c
    INNER JOIN users u ON u.id = $1::uuid
    WHERE c.id = $2::uuid AND ${CHANNEL_ACCESS_PREDICATE}
    LIMIT 1
    `,
    [session.sub, m.channel_id]
  );
  if (!acc.rows[0]?.ok) {
    return NextResponse.json({ message: "접근할 수 없습니다." }, { status: 403 });
  }

  if (!(await canPinMessage(ctx, m.channel_id, kind))) {
    return NextResponse.json({ message: "고정 권한이 없습니다." }, { status: 403 });
  }

  try {
    const ins = await db.query<{ id: string }>(
      `
      INSERT INTO channel_pinned_messages (channel_id, message_id, pinned_by)
      VALUES ($1::uuid, $2::uuid, $3::uuid)
      ON CONFLICT (channel_id, message_id) DO NOTHING
      RETURNING id::text
      `,
      [m.channel_id, messageId, session.sub]
    );
    if (ins.rowCount === 0) {
      const ex = await db.query<{ id: string }>(
        `SELECT id::text FROM channel_pinned_messages WHERE channel_id = $1::uuid AND message_id = $2::uuid`,
        [m.channel_id, messageId]
      );
      return NextResponse.json({ pinId: ex.rows[0]?.id ?? null, alreadyPinned: true });
    }
    return NextResponse.json({ pinId: ins.rows[0]?.id, alreadyPinned: false });
  } catch (e) {
    console.error("[pin]", e);
    return NextResponse.json({ message: "고정하지 못했습니다." }, { status: 500 });
  }
}
