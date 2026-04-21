export const dynamic = "force-dynamic";

import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createActivityLogSafe } from "@/lib/activity-log";
import { deleteAttachmentsForEntity } from "@/lib/file-attachments";
import { deleteStoredFile } from "@/lib/file-storage";
import { canAccessMeetingNote, getMeetingNoteDepartmentId } from "@/lib/meeting-note-access";
import { getUserContext } from "@/lib/user-context";
import { getSessionFromRequest } from "@/lib/session";
import type { ChecklistItem, MeetingNoteDetailDTO, NoteBlockDTO } from "@/types/meeting-notes";

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

const patchSchema = z.object({
  title: z.string().max(500).optional(),
  attendeeUserIds: z.array(z.string().uuid()).max(100).optional(),
  blocks: z.array(blockInput).optional()
});

type RouteCtx = { params: { id: string } };

async function loadNoteDetail(noteId: string): Promise<MeetingNoteDetailDTO | null> {
  const n = await db.query<{
    id: string;
    title: string;
    department_id: string;
    department_name: string;
    created_by: string | null;
    created_at: Date;
    updated_at: Date;
  }>(
    `
    SELECT
      n.id::text,
      n.title,
      n.department_id::text,
      d.name AS department_name,
      n.created_by::text,
      n.created_at,
      n.updated_at
    FROM meeting_notes n
    INNER JOIN departments d ON d.id = n.department_id
    WHERE n.id = $1::uuid
    LIMIT 1
    `,
    [noteId]
  );
  const row = n.rows[0];
  if (!row) {
    return null;
  }

  const att = await db.query<{ user_id: string }>(
    `SELECT user_id::text FROM meeting_note_attendees WHERE note_id = $1::uuid`,
    [noteId]
  );
  const attendeeUserIds = att.rows.map((r) => r.user_id);
  const users = await db.query<{ id: string; name: string; email: string }>(
    attendeeUserIds.length
      ? `SELECT id::text, name, email FROM users WHERE id = ANY($1::uuid[])`
      : `SELECT id::text, name, email FROM users WHERE FALSE`,
    attendeeUserIds.length ? [attendeeUserIds] : []
  );
  const attendees = users.rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email
  }));

  const blocksRes = await db.query<{
    id: string;
    sort_order: number;
    block_type: string;
    body: string | null;
    checklist_items: ChecklistItem[] | null;
  }>(
    `
    SELECT
      id::text,
      sort_order,
      block_type,
      body,
      checklist_items
    FROM note_blocks
    WHERE note_id = $1::uuid
    ORDER BY sort_order ASC, created_at ASC
    `,
    [noteId]
  );

  const blocks: NoteBlockDTO[] = blocksRes.rows.map((b) => {
    const base = {
      id: b.id,
      sortOrder: b.sort_order,
      type: b.block_type as NoteBlockDTO["type"]
    };
    if (b.block_type === "checklist") {
      const items = Array.isArray(b.checklist_items) ? b.checklist_items : [];
      return { ...base, type: "checklist", body: null, checklistItems: items };
    }
    if (b.block_type === "divider") {
      return { ...base, type: "divider", body: null, checklistItems: null };
    }
    return {
      ...base,
      type: b.block_type as "heading" | "paragraph",
      body: b.body,
      checklistItems: null
    };
  });

  return {
    id: row.id,
    title: row.title,
    departmentId: row.department_id,
    departmentName: row.department_name,
    attendeeUserIds,
    attendees,
    blocks,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

export async function GET(_request: NextRequest, context: RouteCtx) {
  const session = getSessionFromRequest(_request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const ctx = await getUserContext(session.sub);
  if (!ctx) {
    return NextResponse.json({ message: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  const { id } = context.params;
  const deptId = await getMeetingNoteDepartmentId(id);
  if (!deptId) {
    return NextResponse.json({ message: "찾을 수 없습니다." }, { status: 404 });
  }
  if (!(await canAccessMeetingNote(ctx, deptId))) {
    return NextResponse.json({ message: "접근할 수 없습니다." }, { status: 403 });
  }

  const detail = await loadNoteDetail(id);
  if (!detail) {
    return NextResponse.json({ message: "찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ note: detail });
}

export async function PATCH(request: NextRequest, context: RouteCtx) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const ctx = await getUserContext(session.sub);
  if (!ctx) {
    return NextResponse.json({ message: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  const { id } = context.params;
  const deptId = await getMeetingNoteDepartmentId(id);
  if (!deptId) {
    return NextResponse.json({ message: "찾을 수 없습니다." }, { status: 404 });
  }
  if (!(await canAccessMeetingNote(ctx, deptId))) {
    return NextResponse.json({ message: "접근할 수 없습니다." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "잘못된 JSON입니다." }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "입력값이 올바르지 않습니다." }, { status: 400 });
  }

  const { title, attendeeUserIds, blocks } = parsed.data;
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    if (title != null) {
      await client.query(`UPDATE meeting_notes SET title = $1, updated_at = NOW() WHERE id = $2::uuid`, [
        title,
        id
      ]);
    }
    if (attendeeUserIds != null) {
      await client.query(`DELETE FROM meeting_note_attendees WHERE note_id = $1::uuid`, [id]);
      const merged = Array.from(new Set([session.sub, ...attendeeUserIds]));
      for (const uid of merged) {
        await client.query(
          `
          INSERT INTO meeting_note_attendees (note_id, user_id)
          VALUES ($1::uuid, $2::uuid)
          ON CONFLICT (note_id, user_id) DO NOTHING
          `,
          [id, uid]
        );
      }
    }
    if (blocks != null) {
      await client.query(`DELETE FROM note_blocks WHERE note_id = $1::uuid`, [id]);
      let order = 0;
      for (const b of blocks) {
        if (b.type === "divider") {
          await client.query(
            `
            INSERT INTO note_blocks (note_id, sort_order, block_type, body, checklist_items)
            VALUES ($1::uuid, $2, 'divider', NULL, NULL)
            `,
            [id, order]
          );
        } else if (b.type === "heading") {
          await client.query(
            `
            INSERT INTO note_blocks (note_id, sort_order, block_type, body, checklist_items)
            VALUES ($1::uuid, $2, 'heading', $3, NULL)
            `,
            [id, order, b.body]
          );
        } else if (b.type === "paragraph") {
          await client.query(
            `
            INSERT INTO note_blocks (note_id, sort_order, block_type, body, checklist_items)
            VALUES ($1::uuid, $2, 'paragraph', $3, NULL)
            `,
            [id, order, b.body]
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
            [id, order, JSON.stringify(items)]
          );
        }
        order += 1;
      }
    }
    await client.query(`UPDATE meeting_notes SET updated_at = NOW() WHERE id = $1::uuid`, [id]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[PATCH meeting-notes]", e);
    return NextResponse.json({ message: "저장하지 못했습니다." }, { status: 500 });
  } finally {
    client.release();
  }

  const detail = await loadNoteDetail(id);
  if (detail) {
    await createActivityLogSafe({
      userId: session.sub,
      actionType: "note_updated",
      entityType: "note",
      entityId: id,
      entityName: detail.title || "제목 없음",
      departmentId: detail.departmentId,
      metadata: { url: `/meeting-notes?id=${encodeURIComponent(id)}` }
    });
  }
  return NextResponse.json({ note: detail });
}

export async function DELETE(_request: NextRequest, context: RouteCtx) {
  const session = getSessionFromRequest(_request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const ctx = await getUserContext(session.sub);
  if (!ctx) {
    return NextResponse.json({ message: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  const { id } = context.params;
  const deptId = await getMeetingNoteDepartmentId(id);
  if (!deptId) {
    return NextResponse.json({ message: "찾을 수 없습니다." }, { status: 404 });
  }
  if (!(await canAccessMeetingNote(ctx, deptId))) {
    return NextResponse.json({ message: "접근할 수 없습니다." }, { status: 403 });
  }

  const removed = await deleteAttachmentsForEntity("meeting_note", id);
  for (const att of removed) {
    await deleteStoredFile(att.storage_key);
  }

  await db.query(`DELETE FROM meeting_notes WHERE id = $1::uuid`, [id]);
  return NextResponse.json({ ok: true });
}
