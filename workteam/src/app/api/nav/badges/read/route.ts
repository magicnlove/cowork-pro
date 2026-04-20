import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { broadcastNavBadgesRefresh } from "@/lib/activity-socket-broadcast";
import { db } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/session";

// `activity`: 액티비티 피드(`/activity-feed`) 확인용. 대시보드「최근 활동」과 별도.
const bodySchema = z.object({
  type: z.enum(["tasks", "calendar", "notes", "activity"])
});

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
    return NextResponse.json({ message: "type이 올바르지 않습니다." }, { status: 400 });
  }

  const { type } = parsed.data;

  await db.query(
    `
    INSERT INTO user_badge_reads (user_id, badge_type, last_read_at)
    VALUES ($1::uuid, $2, NOW())
    ON CONFLICT (user_id, badge_type)
    DO UPDATE SET last_read_at = EXCLUDED.last_read_at
    `,
    [session.sub, type]
  );

  broadcastNavBadgesRefresh();

  return NextResponse.json({ ok: true });
}
