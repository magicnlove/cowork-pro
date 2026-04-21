export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { CHANNEL_ACCESS_PREDICATE } from "@/lib/channel-access";
import { getSessionFromRequest } from "@/lib/session";

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const channelId = request.nextUrl.searchParams.get("channelId");
  const q = request.nextUrl.searchParams.get("q");
  const parsedC = channelId ? z.string().uuid().safeParse(channelId) : null;
  const qTrim = q?.trim() ?? "";

  if (!parsedC?.success || qTrim.length < 1) {
    return NextResponse.json({ message: "channelId와 검색어(q)가 필요합니다." }, { status: 400 });
  }

  const acc = await db.query<{ ok: boolean }>(
    `
    SELECT TRUE AS ok
    FROM channels c
    INNER JOIN users u ON u.id = $1::uuid
    WHERE c.id = $2::uuid AND ${CHANNEL_ACCESS_PREDICATE}
    LIMIT 1
    `,
    [session.sub, parsedC.data]
  );
  if (!acc.rows[0]?.ok) {
    return NextResponse.json({ message: "접근할 수 없습니다." }, { status: 403 });
  }

  const pattern = `%${qTrim.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;

  const res = await db.query<{
    id: string;
    body: string;
    created_at: Date;
    user_name: string;
  }>(
    `
    SELECT m.id::text, m.body, m.created_at, u.name AS user_name
    FROM messages m
    JOIN users u ON u.id = m.user_id
    WHERE m.channel_id = $1::uuid
      AND m.parent_message_id IS NULL
      AND m.deleted_at IS NULL
      AND m.body ILIKE $2 ESCAPE '\\'
    ORDER BY m.created_at DESC
    LIMIT 50
    `,
    [parsedC.data, pattern]
  );

  return NextResponse.json({
    results: res.rows.map((r) => ({
      id: r.id,
      body: r.body,
      createdAt: r.created_at.toISOString(),
      userName: r.user_name
    }))
  });
}
