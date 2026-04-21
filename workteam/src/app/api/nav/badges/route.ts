export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CHANNEL_ACCESS_PREDICATE } from "@/lib/channel-access";
import { getVisibleDepartmentIds } from "@/lib/org-scope";
import { getSessionFromRequest } from "@/lib/session";
import { getUserContext } from "@/lib/user-context";

function todayUtcRange() {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const tomorrow = new Date(todayStart);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return { todayStart, tomorrow };
}

export async function GET(_request: NextRequest) {
  const session = getSessionFromRequest(_request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const ctx = await getUserContext(session.sub);
  if (!ctx) {
    return NextResponse.json({ message: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  const chRes = await db.query<{ n: string }>(
    `
    SELECT COALESCE(SUM(sub.unread)::text, '0') AS n
    FROM (
      SELECT COALESCE(
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
      ) AS unread
      FROM channels c
      INNER JOIN users u ON u.id = $1::uuid
      LEFT JOIN channel_reads cr ON cr.channel_id = c.id AND cr.user_id = $1::uuid
      WHERE ${CHANNEL_ACCESS_PREDICATE}
    ) sub
    `,
    [session.sub]
  );
  const chatUnread = Number.parseInt(chRes.rows[0]?.n ?? "0", 10) || 0;

  let taskOpenSql = `
    SELECT COUNT(*)::int AS n
    FROM tasks t
    LEFT JOIN user_task_reads utr ON utr.task_id = t.id AND utr.user_id = $1::uuid
    WHERE t.assignee_user_id = $1::uuid
      AND t.status <> 'done'
      AND (utr.read_at IS NULL OR t.updated_at > utr.read_at)
  `;
  const taskParams: unknown[] = [session.sub];
  if (ctx.role !== "admin") {
    const scope = await getVisibleDepartmentIds(ctx);
    taskOpenSql += ` AND (
      (t.department_id IS NOT NULL AND t.department_id = ANY($2::uuid[]))
      OR (t.department_id IS NULL AND t.created_by = $1::uuid)
    )`;
    taskParams.push(scope);
  }
  const taskRes = await db.query<{ n: number }>(taskOpenSql, taskParams);
  const tasksMineOpen = taskRes.rows[0]?.n ?? 0;

  const { todayStart, tomorrow } = todayUtcRange();
  const nowIso = new Date().toISOString();

  let calSql = `
    SELECT COUNT(*)::int AS n
    FROM events e
    WHERE e.starts_at < $1::timestamptz
      AND e.ends_at > $2::timestamptz
      AND e.ends_at > $3::timestamptz
      AND (
        NOT EXISTS (
          SELECT 1 FROM user_badge_reads ubr
          WHERE ubr.user_id = $4::uuid AND ubr.badge_type = 'calendar'
        )
        OR EXISTS (
          SELECT 1 FROM user_badge_reads ubr
          WHERE ubr.user_id = $4::uuid AND ubr.badge_type = 'calendar'
          AND (e.updated_at > ubr.last_read_at OR e.created_at > ubr.last_read_at)
        )
      )
  `;
  const calParams: unknown[] = [tomorrow.toISOString(), todayStart.toISOString(), nowIso, session.sub];
  let p = 5;
  if (ctx.role === "admin") {
    calSql += ` AND (
      e.kind = 'announcement'
      OR (e.kind = 'personal' AND (e.created_by = $${p}::uuid OR $${p}::uuid = ANY(e.attendee_user_ids)))
      OR (e.kind = 'team')
    )`;
    calParams.push(ctx.id);
  } else {
    const scope = await getVisibleDepartmentIds(ctx);
    calSql += ` AND (
      e.kind = 'announcement'
      OR (e.kind = 'personal' AND (e.created_by = $${p}::uuid OR $${p}::uuid = ANY(e.attendee_user_ids)))
      OR (e.kind = 'team' AND e.department_id IS NOT NULL AND e.department_id = ANY($${p + 1}::uuid[]))
    )`;
    calParams.push(ctx.id, scope);
  }

  const calRes = await db.query<{ n: number }>(calSql, calParams);
  const calendarTodayRemaining = calRes.rows[0]?.n ?? 0;

  let meetingNotesNew = 0;
  if (ctx.role === "admin") {
    const mn = await db.query<{ n: string }>(
      `
      SELECT COUNT(*)::text AS n
      FROM meeting_notes n
      WHERE n.updated_at > COALESCE(
        (SELECT ubr.last_read_at FROM user_badge_reads ubr
         WHERE ubr.user_id = $1::uuid AND ubr.badge_type = 'notes' LIMIT 1),
        NOW() - INTERVAL '30 days'
      )
      `,
      [session.sub]
    );
    meetingNotesNew = Number.parseInt(mn.rows[0]?.n ?? "0", 10) || 0;
  } else {
    const scope = await getVisibleDepartmentIds(ctx);
    if (scope.length > 0) {
      const mn = await db.query<{ n: string }>(
        `
        SELECT COUNT(*)::text AS n
        FROM meeting_notes n
        WHERE n.department_id = ANY($1::uuid[])
          AND n.updated_at > COALESCE(
            (SELECT ubr.last_read_at FROM user_badge_reads ubr
             WHERE ubr.user_id = $2::uuid AND ubr.badge_type = 'notes' LIMIT 1),
            NOW() - INTERVAL '30 days'
          )
        `,
        [scope, session.sub]
      );
      meetingNotesNew = Number.parseInt(mn.rows[0]?.n ?? "0", 10) || 0;
    }
  }

  /* `activityNew`: 마지막 확인 시각은 액티비티 피드에서만 갱신(badge_type `activity`). 대시보드 방문은 반영하지 않는다. */
  const where: string[] = [
    "al.created_at > COALESCE(" +
      "(SELECT ubr.last_read_at FROM user_badge_reads ubr WHERE ubr.user_id = $1::uuid AND ubr.badge_type = 'activity' LIMIT 1), " +
      "NOW() - INTERVAL '14 days'" +
    ")",
    "al.user_id <> $1::uuid"
  ];
  const params: unknown[] = [session.sub];
  let pn = 2;
  if (ctx.role !== "admin") {
    const scope = await getVisibleDepartmentIds(ctx);
    where.push(`(al.department_id = ANY($${pn}::uuid[]) OR (al.department_id IS NULL AND al.user_id = $${pn + 1}::uuid))`);
    params.push(scope, ctx.id);
    pn += 2;
  }
  const ac = await db.query<{ n: string }>(
    `
    SELECT COUNT(*)::text AS n
    FROM activity_logs al
    WHERE ${where.join(" AND ")}
    `,
    params
  );
  const activityNew = Number.parseInt(ac.rows[0]?.n ?? "0", 10) || 0;

  return NextResponse.json({
    chatUnread,
    tasksMineOpen,
    calendarTodayRemaining,
    meetingNotesNew,
    activityNew
  });
}
