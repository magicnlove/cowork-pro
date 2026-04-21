export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isChannelHost } from "@/lib/chat-permissions";
import { CHANNEL_ACCESS_PREDICATE } from "@/lib/channel-access";
import { getSessionFromRequest } from "@/lib/session";
import { getUserContext } from "@/lib/user-context";

const patchSchema = z.object({
  addUserIds: z.array(z.string().uuid()).max(30).optional(),
  removeUserIds: z.array(z.string().uuid()).max(30).optional()
});

type RouteCtx = { params: { id: string } };

export async function GET(_request: NextRequest, context: RouteCtx) {
  const session = getSessionFromRequest(_request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id: channelId } = context.params;

  const ch = await db.query<{ kind: string }>(`SELECT kind FROM channels WHERE id = $1::uuid`, [channelId]);
  const kind = ch.rows[0]?.kind;
  if (!kind || (kind !== "group_dm" && kind !== "cross_team")) {
    return NextResponse.json({ message: "멤버 목록이 없는 채널입니다." }, { status: 400 });
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

  const res = await db.query<{
    id: string;
    name: string;
    email: string;
    role: string;
  }>(
    `
    SELECT u.id::text, u.name, u.email, cm.role
    FROM channel_members cm
    INNER JOIN users u ON u.id = cm.user_id
    WHERE cm.channel_id = $1::uuid
    ORDER BY
      CASE cm.role WHEN 'host' THEN 0 ELSE 1 END,
      u.name ASC
    `,
    [channelId]
  );

  return NextResponse.json({
    members: res.rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role as "host" | "member"
    }))
  });
}

export async function PATCH(request: NextRequest, context: RouteCtx) {
  const session = getSessionFromRequest(request);
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
  if (!kind || (kind !== "group_dm" && kind !== "cross_team")) {
    return NextResponse.json({ message: "멤버를 관리할 수 없는 채널입니다." }, { status: 400 });
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

  const canManage =
    ctx.role === "admin" || ctx.role === "manager" || (await isChannelHost(session.sub, channelId));
  if (!canManage) {
    return NextResponse.json({ message: "호스트만 멤버를 관리할 수 있습니다." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "잘못된 JSON입니다." }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "입력이 올바르지 않습니다." }, { status: 400 });
  }

  const { addUserIds = [], removeUserIds = [] } = parsed.data;
  if (addUserIds.length === 0 && removeUserIds.length === 0) {
    return NextResponse.json({ message: "추가 또는 제거할 사용자가 없습니다." }, { status: 400 });
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    for (const uid of addUserIds) {
      await client.query(
        `
        INSERT INTO channel_members (channel_id, user_id, role)
        VALUES ($1::uuid, $2::uuid, 'member')
        ON CONFLICT (channel_id, user_id) DO NOTHING
        `,
        [channelId, uid]
      );
    }

    for (const uid of removeUserIds) {
      const h = await client.query(
        `SELECT role FROM channel_members WHERE channel_id = $1::uuid AND user_id = $2::uuid`,
        [channelId, uid]
      );
      if (h.rows[0]?.role === "host") {
        await client.query("ROLLBACK");
        return NextResponse.json({ message: "호스트는 내보낼 수 없습니다." }, { status: 400 });
      }
      await client.query(
        `DELETE FROM channel_members WHERE channel_id = $1::uuid AND user_id = $2::uuid`,
        [channelId, uid]
      );
    }

    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[PATCH members]", e);
    return NextResponse.json({ message: "처리하지 못했습니다." }, { status: 500 });
  } finally {
    client.release();
  }
}
