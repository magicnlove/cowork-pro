export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CHANNEL_ACCESS_PREDICATE } from "@/lib/channel-access";
import { getSessionFromRequest } from "@/lib/session";

type ChannelRow = {
  id: string;
  slug: string;
  kind: "dm" | "company_wide" | "department" | "cross_team" | "group_dm";
  name: string;
  display_name: string;
  unread_count: number;
};

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const result = await db.query<ChannelRow>(
    `
    SELECT
      c.id,
      c.slug,
      c.kind,
      c.name,
      CASE
        WHEN c.kind = 'dm' THEN COALESCE(
          (
            SELECT u2.name FROM users u2
            WHERE u2.id IN (c.dm_user_a_id, c.dm_user_b_id) AND u2.id <> $1::uuid
            LIMIT 1
          ),
          c.name
        )
        ELSE TRIM(LEADING '# ' FROM c.name)
      END AS display_name,
      COALESCE(
        (
          SELECT COUNT(*)::int
          FROM messages m
          WHERE m.channel_id = c.id
            AND m.parent_message_id IS NULL
            AND m.deleted_at IS NULL
            AND m.user_id <> $1::uuid
            AND m.created_at > COALESCE(cr.last_read_at, to_timestamp(0))
        ),
        0
      ) AS unread_count
    FROM channels c
    INNER JOIN users u ON u.id = $1::uuid
    LEFT JOIN channel_reads cr ON cr.channel_id = c.id AND cr.user_id = $1::uuid
    WHERE ${CHANNEL_ACCESS_PREDICATE}
    ORDER BY
      CASE c.kind
        WHEN 'company_wide' THEN 0
        WHEN 'department' THEN 1
        WHEN 'cross_team' THEN 2
        WHEN 'group_dm' THEN 3
        WHEN 'dm' THEN 4
        ELSE 5
      END,
      display_name ASC
    `,
    [session.sub]
  );

  const channels = result.rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    kind: row.kind,
    name: row.name,
    displayName: row.display_name,
    unreadCount: row.unread_count
  }));

  return NextResponse.json({ channels });
}
