import { NextRequest, NextResponse } from "next/server";
import { broadcastNavBadgesRefresh } from "@/lib/activity-socket-broadcast";
import { db } from "@/lib/db";
import { canUserAccessTask } from "@/lib/task-access";
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

  const { id } = context.params;

  const row = await db.query<{
    department_id: string | null;
    created_by: string | null;
  }>(
    `
    SELECT department_id::text, created_by::text
    FROM tasks
    WHERE id = $1::uuid
    LIMIT 1
    `,
    [id]
  );
  const task = row.rows[0];
  if (!task) {
    return NextResponse.json({ message: "찾을 수 없습니다." }, { status: 404 });
  }

  if (
    !(await canUserAccessTask(ctx, {
      departmentId: task.department_id,
      createdBy: task.created_by
    }))
  ) {
    return NextResponse.json({ message: "접근 권한이 없습니다." }, { status: 403 });
  }

  await db.query(
    `
    INSERT INTO user_task_reads (user_id, task_id, read_at)
    VALUES ($1::uuid, $2::uuid, NOW())
    ON CONFLICT (user_id, task_id)
    DO UPDATE SET read_at = EXCLUDED.read_at
    `,
    [session.sub, id]
  );

  broadcastNavBadgesRefresh();

  return NextResponse.json({ ok: true });
}
