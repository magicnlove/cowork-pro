import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createActivityLogSafe } from "@/lib/activity-log";
import { canAccessMeetingNote } from "@/lib/meeting-note-access";
import { getVisibleDepartmentIds } from "@/lib/org-scope";
import { getSessionFromRequest } from "@/lib/session";
import { getUserContext } from "@/lib/user-context";
import type { MeetingNoteListItemDTO } from "@/types/meeting-notes";

const checklistItemSchema = z.object({
  id: z.string().uuid().optional(),
  text: z.string(),
  checked: z.boolean()
});

const blockInput = z.discriminatedUnion("type", [
  z.object({ type: z.literal("heading"), body: z.string() }),
  z.object({ type: z.literal("paragraph"), body: z.string() }),
  z.object({ type: z.literal("divider") }),
  z.object({ type: z.literal("checklist"), items: z.array(checklistItemSchema) })
]);

const postSchema = z.object({
  title: z.string().max(500).optional().default(""),
  departmentId: z.string().uuid(),
  attendeeUserIds: z.array(z.string().uuid()).max(100).optional().default([]),
  blocks: z.array(blockInput).optional().default([])
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

  if (ctx.role === "admin") {
    const res = await db.query<{
      id: string;
      title: string;
      department_id: string;
      department_name: string;
      updated_at: Date;
      created_at: Date;
    }>(
      `
      SELECT
        n.id::text,
        n.title,
        n.department_id::text,
        d.name AS department_name,
        n.updated_at,
        n.created_at
      FROM meeting_notes n
      INNER JOIN departments d ON d.id = n.department_id
      ORDER BY n.sort_order ASC, n.updated_at DESC
      LIMIT 200
      `
    );
    const notes: MeetingNoteListItemDTO[] = res.rows.map((r) => ({
      id: r.id,
      title: r.title,
      departmentId: r.department_id,
      departmentName: r.department_name,
      updatedAt: r.updated_at.toISOString(),
      createdAt: r.created_at.toISOString()
    }));
    return NextResponse.json({ notes });
  }

  const scope = await getVisibleDepartmentIds(ctx);
  if (scope.length === 0) {
    return NextResponse.json({ notes: [] as MeetingNoteListItemDTO[] });
  }

  const res = await db.query<{
    id: string;
    title: string;
    department_id: string;
    department_name: string;
    updated_at: Date;
    created_at: Date;
  }>(
    `
    SELECT
      n.id::text,
      n.title,
      n.department_id::text,
      d.name AS department_name,
      n.updated_at,
      n.created_at
    FROM meeting_notes n
    INNER JOIN departments d ON d.id = n.department_id
    WHERE n.department_id = ANY($1::uuid[])
    ORDER BY n.sort_order ASC, n.updated_at DESC
    LIMIT 200
    `,
    [scope]
  );

  const notes: MeetingNoteListItemDTO[] = res.rows.map((r) => ({
    id: r.id,
    title: r.title,
    departmentId: r.department_id,
    departmentName: r.department_name,
    updatedAt: r.updated_at.toISOString(),
    createdAt: r.created_at.toISOString()
  }));
  return NextResponse.json({ notes });
}

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const ctx = await getUserContext(session.sub);
  if (!ctx) {
    return NextResponse.json({ message: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "잘못된 JSON입니다." }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "입력값이 올바르지 않습니다." }, { status: 400 });
  }

  const { title, departmentId, attendeeUserIds, blocks } = parsed.data;
  if (!(await canAccessMeetingNote(ctx, departmentId))) {
    return NextResponse.json({ message: "이 부서에 노트를 만들 권한이 없습니다." }, { status: 403 });
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const ord = await client.query<{ next_order: string }>(
      `
      SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
      FROM meeting_notes
      WHERE department_id = $1::uuid
      `,
      [departmentId]
    );
    const nextOrder = Number(ord.rows[0]?.next_order ?? 0);

    const ins = await client.query<{ id: string }>(
      `
      INSERT INTO meeting_notes (department_id, title, sort_order, created_by)
      VALUES ($1::uuid, $2, $3, $4::uuid)
      RETURNING id::text
      `,
      [departmentId, title.trim() || "제목 없음", nextOrder, session.sub]
    );
    const noteId = ins.rows[0]!.id;

    const attendees = Array.from(new Set([session.sub, ...attendeeUserIds]));
    for (const uid of attendees) {
      await client.query(
        `
        INSERT INTO meeting_note_attendees (note_id, user_id)
        VALUES ($1::uuid, $2::uuid)
        ON CONFLICT (note_id, user_id) DO NOTHING
        `,
        [noteId, uid]
      );
    }

    let order = 0;
    for (const b of blocks) {
      if (b.type === "divider") {
        await client.query(
          `
          INSERT INTO note_blocks (note_id, sort_order, block_type, body, checklist_items)
          VALUES ($1::uuid, $2, 'divider', NULL, NULL)
          `,
          [noteId, order]
        );
      } else if (b.type === "heading") {
        await client.query(
          `
          INSERT INTO note_blocks (note_id, sort_order, block_type, body, checklist_items)
          VALUES ($1::uuid, $2, 'heading', $3, NULL)
          `,
          [noteId, order, b.body]
        );
      } else if (b.type === "paragraph") {
        await client.query(
          `
          INSERT INTO note_blocks (note_id, sort_order, block_type, body, checklist_items)
          VALUES ($1::uuid, $2, 'paragraph', $3, NULL)
          `,
          [noteId, order, b.body]
        );
      } else if (b.type === "checklist") {
        const items = b.items.map((it) => ({
          id: it.id ?? randomUUID(),
          text: it.text,
          checked: it.checked
        }));
        await client.query(
          `
          INSERT INTO note_blocks (note_id, sort_order, block_type, body, checklist_items)
          VALUES ($1::uuid, $2, 'checklist', NULL, $3::jsonb)
          `,
          [noteId, order, JSON.stringify(items)]
        );
      }
      order += 1;
    }

    await client.query("COMMIT");
    await createActivityLogSafe({
      userId: session.sub,
      actionType: "note_created",
      entityType: "note",
      entityId: noteId,
      entityName: title.trim() || "제목 없음",
      departmentId,
      metadata: { url: `/meeting-notes?id=${encodeURIComponent(noteId)}` }
    });
    return NextResponse.json({ id: noteId });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[POST meeting-notes]", e);
    return NextResponse.json({ message: "저장하지 못했습니다." }, { status: 500 });
  } finally {
    client.release();
  }
}
