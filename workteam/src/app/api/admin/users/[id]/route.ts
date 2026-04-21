export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { denyUnlessAdmin } from "@/lib/require-admin";
import { getSessionFromRequest } from "@/lib/session";
import { getUserContext } from "@/lib/user-context";

const roleSchema = z.enum(["admin", "manager", "member"]);
const deptRoleSchema = z.enum(["admin", "manager", "member"]);
const assignmentSchema = z.object({
  departmentId: z.string().uuid(),
  isPrimary: z.boolean().optional(),
  role: deptRoleSchema
});

const patchSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    role: roleSchema.optional(),
    departmentAssignments: z.array(assignmentSchema).max(30).optional()
  })
  .strict();

type RouteCtx = { params: { id: string } };

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

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const fields: string[] = [];
    const vals: unknown[] = [];
    let n = 1;
    if (data.name !== undefined) {
      fields.push(`name = $${n++}`);
      vals.push(data.name);
    }
    if (data.role !== undefined) {
      fields.push(`role = $${n++}`);
      vals.push(data.role);
    }
    if (fields.length > 0) {
      vals.push(id);
      const r = await client.query(
        `UPDATE users SET ${fields.join(", ")} WHERE id = $${n}::uuid RETURNING id`,
        vals
      );
      if (r.rowCount === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ message: "찾을 수 없습니다." }, { status: 404 });
      }
    }

    if (data.departmentAssignments !== undefined) {
      const normalized = data.departmentAssignments.map((a) => ({
        ...a,
        isPrimary: Boolean(a.isPrimary)
      }));
      if (normalized.length > 0 && !normalized.some((a) => a.isPrimary)) {
        normalized[0]!.isPrimary = true;
      }
      if (normalized.filter((a) => a.isPrimary).length > 1) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { message: "주 소속 부서는 하나만 선택할 수 있습니다." },
          { status: 400 }
        );
      }
      await client.query(`DELETE FROM user_departments WHERE user_id = $1::uuid`, [id]);
      for (const a of normalized) {
        await client.query(
          `
          INSERT INTO user_departments (user_id, department_id, is_primary, role)
          VALUES ($1::uuid, $2::uuid, $3, $4)
          `,
          [id, a.departmentId, a.isPrimary, a.role]
        );
      }
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[PATCH /api/admin/users/[id]]", e);
    return NextResponse.json({ message: "수정하지 못했습니다." }, { status: 500 });
  } finally {
    client.release();
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, context: RouteCtx) {
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
  const target = await db.query<{ role: "admin" | "manager" | "member" }>(
    `SELECT role FROM users WHERE id = $1::uuid LIMIT 1`,
    [id]
  );
  if (target.rowCount === 0) {
    return NextResponse.json({ message: "찾을 수 없습니다." }, { status: 404 });
  }
  if (target.rows[0].role === "admin") {
    return NextResponse.json({ message: "admin 계정은 삭제할 수 없습니다." }, { status: 400 });
  }

  try {
    const del = await db.query(`DELETE FROM users WHERE id = $1::uuid RETURNING id`, [id]);
    if (del.rowCount === 0) {
      return NextResponse.json({ message: "찾을 수 없습니다." }, { status: 404 });
    }
  } catch (e) {
    console.error("[DELETE /api/admin/users/[id]]", e);
    return NextResponse.json(
      { message: "사용자를 삭제하지 못했습니다. 연결된 데이터가 있는지 확인해 주세요." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
