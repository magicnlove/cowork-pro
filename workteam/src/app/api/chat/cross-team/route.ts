import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/session";
import { getUserContext } from "@/lib/user-context";

const bodySchema = z.object({
  name: z.string().min(1).max(120),
  memberUserIds: z.array(z.string().uuid()).max(50).optional()
});

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const ctx = await getUserContext(session.sub);
  if (!ctx) {
    return NextResponse.json({ message: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }
  if (ctx.role !== "admin" && ctx.role !== "manager") {
    return NextResponse.json(
      { message: "크로스팀 채널은 관리자·매니저만 생성할 수 있습니다." },
      { status: 403 }
    );
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
  const members = Array.from(new Set([creator, ...(parsed.data.memberUserIds ?? [])]));
  const slug = `xt-${crypto.randomUUID()}`;

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const ins = await client.query<{ id: string }>(
      `
      INSERT INTO channels (slug, name, kind, created_by)
      VALUES ($1, $2, 'cross_team', $3::uuid)
      RETURNING id::text
      `,
      [slug, parsed.data.name.trim(), creator]
    );
    const channelId = ins.rows[0].id;

    for (const uid of members) {
      const role = uid === creator ? "host" : "member";
      await client.query(
        `
        INSERT INTO channel_members (channel_id, user_id, role)
        VALUES ($1::uuid, $2::uuid, $3)
        ON CONFLICT (channel_id, user_id) DO NOTHING
        `,
        [channelId, uid, role]
      );
    }

    await client.query("COMMIT");
    return NextResponse.json({ channelId });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[POST /api/chat/cross-team]", e);
    return NextResponse.json({ message: "채널을 만들지 못했습니다." }, { status: 500 });
  } finally {
    client.release();
  }
}
