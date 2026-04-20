import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { denyUnlessAdmin } from "@/lib/require-admin";
import { getSessionFromRequest } from "@/lib/session";
import { getUserContext } from "@/lib/user-context";

const patchSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    code: z.string().min(1).max(64).optional(),
    parentId: z.string().uuid().nullable().optional(),
    sortOrder: z.number().int().min(0).optional(),
    managerUserId: z.string().uuid().nullable().optional()
  })
  .strict();

type RouteCtx = { params: { id: string } };

/** newParent가 id의 하위(본인 포함)이면 상위 변경 시 순환됨 */
async function newParentUnderBranch(id: string, newParentId: string): Promise<boolean> {
  const res = await db.query(
    `
    WITH RECURSIVE sub AS (
      SELECT id FROM departments WHERE id = $1::uuid
      UNION ALL
      SELECT d.id FROM departments d INNER JOIN sub ON d.parent_id = sub.id
    )
    SELECT 1 FROM sub WHERE id = $2::uuid LIMIT 1
    `,
    [id, newParentId]
  );
  return Boolean(res.rows[0]);
}

export async function PATCH(request: NextRequest, context: RouteCtx) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const ctx = await getUserContext(session.sub);
  const denied = denyUnlessAdmin(ctx);
  if (denied) {
    return denied;
  }

  const { id } = context.params;

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
  const data = parsed.data;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ message: "변경할 내용이 없습니다." }, { status: 400 });
  }

  if (data.parentId !== undefined && data.parentId === id) {
    return NextResponse.json({ message: "자기 자신을 상위 부서로 둘 수 없습니다." }, { status: 400 });
  }
  if (data.parentId) {
    const bad = await newParentUnderBranch(id, data.parentId);
    if (bad) {
      return NextResponse.json({ message: "하위 부서를 상위로 지정할 수 없습니다." }, { status: 400 });
    }
  }

  let depth: number | null = null;
  if (data.parentId !== undefined) {
    if (data.parentId === null) {
      depth = 0;
    } else {
      const p = await db.query<{ depth: number }>(
        `SELECT depth FROM departments WHERE id = $1::uuid`,
        [data.parentId]
      );
      if (p.rowCount === 0) {
        return NextResponse.json({ message: "상위 부서를 찾을 수 없습니다." }, { status: 400 });
      }
      depth = p.rows[0].depth + 1;
    }
  }

  const fields: string[] = [];
  const vals: unknown[] = [];
  let n = 1;
  if (data.name !== undefined) {
    fields.push(`name = $${n++}`);
    vals.push(data.name);
  }
  if (data.code !== undefined) {
    fields.push(`code = $${n++}`);
    vals.push(data.code);
  }
  if (data.parentId !== undefined) {
    fields.push(`parent_id = $${n++}::uuid`);
    vals.push(data.parentId);
  }
  if (data.sortOrder !== undefined) {
    fields.push(`sort_order = $${n++}`);
    vals.push(data.sortOrder);
  }
  if (data.managerUserId !== undefined) {
    fields.push(`manager_user_id = $${n++}::uuid`);
    vals.push(data.managerUserId);
  }
  if (depth !== null) {
    fields.push(`depth = $${n++}`);
    vals.push(depth);
  }
  vals.push(id);

  try {
    await db.query(`UPDATE departments SET ${fields.join(", ")} WHERE id = $${n}::uuid`, vals);
  } catch (e) {
    console.error("[PATCH /api/admin/departments/[id]]", e);
    return NextResponse.json({ message: "수정하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, context: RouteCtx) {
  const session = getSessionFromRequest(_request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const ctx = await getUserContext(session.sub);
  const denied = denyUnlessAdmin(ctx);
  if (denied) {
    return denied;
  }

  const { id } = context.params;

  const ch = await db.query(`SELECT 1 FROM departments WHERE parent_id = $1::uuid LIMIT 1`, [id]);
  if (ch.rowCount && ch.rowCount > 0) {
    return NextResponse.json({ message: "하위 부서가 있어 삭제할 수 없습니다." }, { status: 400 });
  }
  const us = await db.query(`SELECT 1 FROM user_departments WHERE department_id = $1::uuid LIMIT 1`, [id]);
  if (us.rowCount && us.rowCount > 0) {
    return NextResponse.json({ message: "소속 사용자가 있어 삭제할 수 없습니다." }, { status: 400 });
  }
  const chn = await db.query(`SELECT 1 FROM channels WHERE department_id = $1::uuid LIMIT 1`, [id]);
  if (chn.rowCount && chn.rowCount > 0) {
    await db.query(`DELETE FROM channels WHERE department_id = $1::uuid`, [id]);
  }

  const del = await db.query(`DELETE FROM departments WHERE id = $1::uuid RETURNING id`, [id]);
  if (del.rowCount === 0) {
    return NextResponse.json({ message: "찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
