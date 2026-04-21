export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/session";

const bodySchema = z.object({
  name: z.string().max(120).optional(),
  memberUserIds: z.array(z.string().uuid()).min(1).max(50)
});

function uniq(ids: string[]) {
  return Array.from(new Set(ids));
}

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "잘못된 JSON입니다." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "입력값이 올바르지 않습니다." }, { status: 400 });
  }

  const creator = session.sub;
  const members = uniq([creator, ...parsed.data.memberUserIds]);
  const roomName =
    parsed.data.name?.trim() ||
    (members.length === 2 ? "DM" : `그룹 채팅 (${members.length}명)`);

  if (members.length === 2) {
    const [a, b] = members;
    const existing = await db.query<{ id: string }>(
      `
      SELECT c.id::text
      FROM channels c
      WHERE c.kind = 'group_dm'
        AND (SELECT COUNT(*)::int FROM channel_members cm WHERE cm.channel_id = c.id) = 2
        AND EXISTS (SELECT 1 FROM channel_members WHERE channel_id = c.id AND user_id = $1::uuid)
        AND EXISTS (SELECT 1 FROM channel_members WHERE channel_id = c.id AND user_id = $2::uuid)
      LIMIT 1
      `,
      [a, b]
    );
    if (existing.rows[0]) {
      return NextResponse.json({ channelId: existing.rows[0].id, reused: true });
    }
  }

  const slug = `gd-${crypto.randomUUID()}`;

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const ins = await client.query<{ id: string }>(
      `
      INSERT INTO channels (slug, name, kind, created_by)
      VALUES ($1, $2, 'group_dm', $3::uuid)
      RETURNING id::text
      `,
      [slug, roomName, creator]
    );
    const channelId = ins.rows[0].id;

    for (const uid of members) {
      const role = uid === creator ? "host" : "member";
      await client.query(
        `
        INSERT INTO channel_members (channel_id, user_id, role)
        VALUES ($1::uuid, $2::uuid, $3)
        `,
        [channelId, uid, role]
      );
    }

    await client.query("COMMIT");
    return NextResponse.json({ channelId, reused: false });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[POST /api/chat/direct]", e);
    return NextResponse.json({ message: "채팅방을 만들지 못했습니다." }, { status: 500 });
  } finally {
    client.release();
  }
}
