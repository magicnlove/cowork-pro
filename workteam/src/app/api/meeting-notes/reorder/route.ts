import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { canAccessMeetingNote } from "@/lib/meeting-note-access";
import { getSessionFromRequest } from "@/lib/session";
import { getUserContext } from "@/lib/user-context";

const schema = z.object({
  orderedNoteIds: z.array(z.string().uuid()).min(1)
});

export async function PATCH(request: NextRequest) {
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
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "입력값이 올바르지 않습니다." }, { status: 400 });
  }

  const ids = parsed.data.orderedNoteIds;
  const rows = await db.query<{ id: string; department_id: string }>(
    `
    SELECT id::text, department_id::text
    FROM meeting_notes
    WHERE id = ANY($1::uuid[])
    `,
    [ids]
  );
  if (rows.rowCount !== ids.length) {
    return NextResponse.json({ message: "일부 노트를 찾을 수 없습니다." }, { status: 404 });
  }

  const deptId = rows.rows[0]?.department_id;
  if (!deptId) {
    return NextResponse.json({ message: "부서 정보가 없습니다." }, { status: 400 });
  }
  if (rows.rows.some((r) => r.department_id !== deptId)) {
    return NextResponse.json({ message: "같은 부서 노트만 정렬할 수 있습니다." }, { status: 400 });
  }
  if (!(await canAccessMeetingNote(ctx, deptId))) {
    return NextResponse.json({ message: "접근 권한이 없습니다." }, { status: 403 });
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    for (let i = 0; i < ids.length; i += 1) {
      await client.query(
        `UPDATE meeting_notes SET sort_order = $1, updated_at = updated_at WHERE id = $2::uuid`,
        [i, ids[i]]
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[PATCH meeting-notes/reorder]", e);
    return NextResponse.json({ message: "정렬을 저장하지 못했습니다." }, { status: 500 });
  } finally {
    client.release();
  }

  return NextResponse.json({ ok: true });
}

