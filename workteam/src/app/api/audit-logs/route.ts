import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listWorkspaceIdsForUser } from "@/lib/archive-scope";
import { db } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/session";
import { getUserContext } from "@/lib/user-context";
import type { AuditLogDTO } from "@/types/archive";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  cursorTs: z.string().optional(),
  cursorId: z.string().uuid().optional()
});

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const ctx = await getUserContext(session.sub);
  if (!ctx) {
    return NextResponse.json({ message: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  const parsed = querySchema.safeParse({
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
    cursorTs: request.nextUrl.searchParams.get("cursorTs") ?? undefined,
    cursorId: request.nextUrl.searchParams.get("cursorId") ?? undefined
  });
  if (!parsed.success) {
    return NextResponse.json({ message: "쿼리가 올바르지 않습니다." }, { status: 400 });
  }

  const { limit, cursorTs, cursorId } = parsed.data;
  if ((cursorTs && !cursorId) || (!cursorTs && cursorId)) {
    return NextResponse.json({ message: "cursorTs와 cursorId를 함께 전달해 주세요." }, { status: 400 });
  }

  const myWs = await listWorkspaceIdsForUser(ctx.id);
  if (myWs.length === 0) {
    return NextResponse.json({ items: [] as AuditLogDTO[], nextCursor: null });
  }

  const params: unknown[] = [ctx.id, myWs];
  let p = 3;
  let cursorClause = "";
  if (cursorTs && cursorId) {
    cursorClause = `AND (al."timestamp", al.id) < ($${p}::timestamptz, $${p + 1}::uuid)`;
    params.push(cursorTs, cursorId);
    p += 2;
  }
  params.push(limit + 1);

  const res = await db.query<{
    id: string;
    user_id: string;
    user_name: string;
    action: string;
    target_id: string | null;
    ts: Date;
  }>(
    `
    SELECT
      al.id::text,
      al.user_id::text,
      u.name AS user_name,
      al.action,
      al.target_id::text,
      al."timestamp" AS ts
    FROM audit_logs al
    INNER JOIN users u ON u.id = al.user_id
    WHERE (
      al.user_id = $1::uuid
      OR al.target_id = ANY($2::uuid[])
      OR EXISTS (
        SELECT 1 FROM documents d
        WHERE d.id = al.target_id AND d.workspace_id = ANY($2::uuid[])
      )
    )
    ${cursorClause}
    ORDER BY al."timestamp" DESC, al.id DESC
    LIMIT $${p}
    `,
    params
  );

  const rows = res.rows;
  const hasMore = rows.length > limit;
  const sliced = rows.slice(0, limit);
  const items: AuditLogDTO[] = sliced.map((r) => ({
    id: r.id,
    userId: r.user_id,
    userName: r.user_name,
    action: r.action,
    targetId: r.target_id,
    timestamp: r.ts.toISOString()
  }));
  const last = items[items.length - 1];
  return NextResponse.json({
    items,
    nextCursor:
      hasMore && last ? { cursorTs: last.timestamp, cursorId: last.id } : null
  });
}
