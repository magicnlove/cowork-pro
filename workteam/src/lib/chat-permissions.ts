import { db } from "@/lib/db";
import type { UserContext } from "@/lib/user-context";

export async function isChannelHost(userId: string, channelId: string): Promise<boolean> {
  const res = await db.query<{ ok: boolean }>(
    `
    SELECT TRUE AS ok
    FROM channels c
    WHERE c.id = $2::uuid
      AND c.kind IN ('cross_team', 'group_dm')
      AND (
        EXISTS (
          SELECT 1 FROM channel_members cm
          WHERE cm.channel_id = c.id AND cm.user_id = $1::uuid AND cm.role = 'host'
        )
        OR c.created_by = $1::uuid
      )
    LIMIT 1
    `,
    [userId, channelId]
  );
  return Boolean(res.rows[0]?.ok);
}

/** admin / org manager 전 채널, 크로스팀·그룹DM은 host도 가능 */
export async function canPinMessage(
  ctx: UserContext,
  channelId: string,
  channelKind: string
): Promise<boolean> {
  if (ctx.role === "admin" || ctx.role === "manager") {
    return true;
  }
  if (channelKind === "cross_team" || channelKind === "group_dm") {
    return isChannelHost(ctx.id, channelId);
  }
  return false;
}
