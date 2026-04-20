import { NextRequest, NextResponse } from "next/server";
import { canUserDeleteActivityLog, canUserViewActivityLog } from "@/lib/activity-scope";
import { db } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/session";
import { getUserContext } from "@/lib/user-context";

type RouteCtx = { params: { id: string } };

export async function DELETE(request: NextRequest, context: RouteCtx) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const ctx = await getUserContext(session.sub);
  if (!ctx) {
    return NextResponse.json({ message: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  const { id } = context.params;
  const row = await db.query<{
    user_id: string;
    department_id: string | null;
    entity_type: string | null;
    entity_id: string | null;
  }>(
    `
    SELECT user_id::text, department_id::text, entity_type, entity_id::text
    FROM activity_logs
    WHERE id = $1::uuid
    LIMIT 1
    `,
    [id]
  );
  const log = row.rows[0];
  if (!log) {
    return NextResponse.json({ message: "찾을 수 없습니다." }, { status: 404 });
  }

  const canView = await canUserViewActivityLog(ctx, {
    user_id: log.user_id,
    department_id: log.department_id,
    entity_type: log.entity_type,
    entity_id: log.entity_id
  });
  if (!canView) {
    return NextResponse.json({ message: "찾을 수 없습니다." }, { status: 404 });
  }

  if (!canUserDeleteActivityLog(ctx, log.user_id)) {
    return NextResponse.json({ message: "삭제할 권한이 없습니다." }, { status: 403 });
  }

  await db.query(`DELETE FROM activity_logs WHERE id = $1::uuid`, [id]);
  return NextResponse.json({ ok: true });
}
