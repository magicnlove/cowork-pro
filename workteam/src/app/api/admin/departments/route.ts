export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { denyUnlessAdmin } from "@/lib/require-admin";
import { getSessionFromRequest } from "@/lib/session";
import { getUserContext } from "@/lib/user-context";

const postSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(64),
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().min(0).optional()
});

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const ctx = await getUserContext(session.sub);
  const denied = denyUnlessAdmin(ctx);
  if (denied) {
    return denied;
  }

  const res = await db.query<{
    id: string;
    name: string;
    code: string;
    parent_id: string | null;
    manager_user_id: string | null;
    depth: number;
    sort_order: number;
    created_at: Date;
  }>(
    `
    SELECT
      id::text,
      name,
      code,
      parent_id::text,
      manager_user_id::text,
      depth,
      sort_order,
      created_at
    FROM departments
    ORDER BY depth ASC, sort_order ASC, name ASC
    `
  );

  return NextResponse.json({
    departments: res.rows.map((r) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      parentId: r.parent_id,
      managerUserId: r.manager_user_id,
      depth: r.depth,
      sortOrder: r.sort_order,
      createdAt: r.created_at.toISOString()
    }))
  });
}

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const ctx = await getUserContext(session.sub);
  const denied = denyUnlessAdmin(ctx);
  if (denied) {
    return denied;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "잘못된 JSON입니다." }, { status: 400 });
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "입력값이 올바르지 않습니다.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { name, code, parentId = null, sortOrder = 0 } = parsed.data;

  let depth = 0;
  if (parentId) {
    const p = await db.query<{ depth: number }>(
      `SELECT depth FROM departments WHERE id = $1::uuid LIMIT 1`,
      [parentId]
    );
    if (p.rowCount === 0) {
      return NextResponse.json({ message: "상위 부서를 찾을 수 없습니다." }, { status: 400 });
    }
    depth = p.rows[0].depth + 1;
  }

  try {
    const ins = await db.query<{ id: string }>(
      `
      INSERT INTO departments (name, code, parent_id, depth, sort_order)
      VALUES ($1, $2, $3::uuid, $4, $5)
      RETURNING id::text
      `,
      [name, code, parentId, depth, sortOrder]
    );
    const newId = ins.rows[0].id;
    const slug = `dept-${code.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${newId.slice(0, 8)}`;
    await db.query(
      `
      INSERT INTO channels (slug, name, kind, department_id)
      VALUES ($1, $2, 'department', $3::uuid)
      `,
      [slug, `# ${name} · 부서`, newId]
    );
    return NextResponse.json({ id: newId });
  } catch (e) {
    console.error("[POST /api/admin/departments]", e);
    return NextResponse.json({ message: "부서를 저장하지 못했습니다." }, { status: 500 });
  }
}
