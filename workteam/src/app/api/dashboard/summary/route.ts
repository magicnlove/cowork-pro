export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getRecentModifiedDocuments } from "@/lib/archive-queries";
import { db } from "@/lib/db";
import { getVisibleDepartmentIds } from "@/lib/org-scope";
import { getSessionFromRequest } from "@/lib/session";
import { getUserContext } from "@/lib/user-context";

function dateIso(d: Date): string {
  return d.toISOString();
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

  let scope: string[] = [];
  if (ctx.role !== "admin") {
    scope = await getVisibleDepartmentIds(ctx);
  }

  const taskRes =
    ctx.role === "admin"
      ? await db.query<{
          id: string;
          title: string;
          due_date: string | null;
          status: string;
        }>(
          `
          SELECT id::text, title, due_date::text, status
          FROM tasks
          WHERE due_date = CURRENT_DATE
          ORDER BY status ASC, position ASC, created_at DESC
          LIMIT 5
          `
        )
      : await db.query<{
          id: string;
          title: string;
          due_date: string | null;
          status: string;
        }>(
          `
          SELECT id::text, title, due_date::text, status
          FROM tasks
          WHERE due_date = CURRENT_DATE
            AND ((department_id IS NOT NULL AND department_id = ANY($1::uuid[]))
              OR (department_id IS NULL AND created_by = $2::uuid))
          ORDER BY status ASC, position ASC, created_at DESC
          LIMIT 5
          `,
          [scope, ctx.id]
        );

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const tomorrow = new Date(todayStart);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const eventRes =
    ctx.role === "admin"
      ? await db.query<{
          id: string;
          title: string;
          starts_at: Date;
          kind: string;
        }>(
          `
          SELECT id::text, title, starts_at, kind
          FROM events
          WHERE starts_at < $2::timestamptz
            AND ends_at > $1::timestamptz
          ORDER BY starts_at ASC
          LIMIT 5
          `,
          [todayStart.toISOString(), tomorrow.toISOString()]
        )
      : await db.query<{
          id: string;
          title: string;
          starts_at: Date;
          kind: string;
        }>(
          `
          SELECT id::text, title, starts_at, kind
          FROM events
          WHERE starts_at < $2::timestamptz
            AND ends_at > $1::timestamptz
            AND (
              kind = 'announcement'
              OR (kind = 'personal' AND (created_by = $3::uuid OR $3::uuid = ANY(attendee_user_ids)))
              OR (kind = 'team' AND department_id IS NOT NULL AND department_id = ANY($4::uuid[]))
            )
          ORDER BY starts_at ASC
          LIMIT 5
          `,
          [todayStart.toISOString(), tomorrow.toISOString(), ctx.id, scope]
        );

  const recentModifiedDocuments = await getRecentModifiedDocuments(ctx.id, 5);

  const actRes =
    ctx.role === "admin"
      ? await db.query<{ id: string; user_name: string; entity_name: string; action_type: string; created_at: Date }>(
          `
          SELECT al.id::text, u.name AS user_name, al.entity_name, al.action_type, al.created_at
          FROM activity_logs al
          INNER JOIN users u ON u.id = al.user_id
          ORDER BY al.created_at DESC, al.id DESC
          LIMIT 5
          `
        )
      : await db.query<{ id: string; user_name: string; entity_name: string; action_type: string; created_at: Date }>(
          `
          SELECT al.id::text, u.name AS user_name, al.entity_name, al.action_type, al.created_at
          FROM activity_logs al
          INNER JOIN users u ON u.id = al.user_id
          WHERE (al.department_id = ANY($1::uuid[]) OR (al.department_id IS NULL AND al.user_id = $2::uuid))
          ORDER BY al.created_at DESC, al.id DESC
          LIMIT 5
          `,
          [scope, ctx.id]
        );

  return NextResponse.json({
    recentModifiedDocuments,
    todayTasks: taskRes.rows.map((r) => ({
      id: r.id,
      title: r.title,
      dueDate: r.due_date,
      status: r.status
    })),
    todayEvents: eventRes.rows.map((r) => ({
      id: r.id,
      title: r.title,
      startsAt: dateIso(r.starts_at),
      kind: r.kind
    })),
    recentActivities: actRes.rows.map((r) => ({
      id: r.id,
      userName: r.user_name,
      entityName: r.entity_name,
      actionType: r.action_type,
      createdAt: dateIso(r.created_at)
    }))
  });
}

