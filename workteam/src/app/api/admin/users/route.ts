export const dynamic = "force-dynamic";

import bcrypt from "bcrypt";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { denyUnlessAdmin } from "@/lib/require-admin";
import { validatePasswordPolicy } from "@/lib/password-policy";
import { getSessionFromRequest } from "@/lib/session";
import { getUserContext } from "@/lib/user-context";

const roleSchema = z.enum(["admin", "manager", "member"]);
const deptRoleSchema = z.enum(["admin", "manager", "member"]);
const assignmentSchema = z.object({
  departmentId: z.string().uuid(),
  isPrimary: z.boolean().optional(),
  role: deptRoleSchema
});

const postSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(100),
  role: roleSchema,
  departmentAssignments: z.array(assignmentSchema).max(30).optional().default([])
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

  const sp = request.nextUrl.searchParams;
  const nameQ = sp.get("name")?.trim() ?? "";
  const emailQ = sp.get("email")?.trim() ?? "";
  const roleQ = sp.get("role")?.trim() ?? "";
  const departmentIdQ = sp.get("departmentId")?.trim() ?? "";

  const filters: string[] = [];
  const filterParams: unknown[] = [];
  let fp = 1;
  if (nameQ) {
    filters.push(`u.name ILIKE $${fp}`);
    filterParams.push(`%${nameQ}%`);
    fp += 1;
  }
  if (emailQ) {
    filters.push(`u.email ILIKE $${fp}`);
    filterParams.push(`%${emailQ}%`);
    fp += 1;
  }
  if (roleQ === "admin" || roleQ === "manager" || roleQ === "member") {
    filters.push(`u.role = $${fp}`);
    filterParams.push(roleQ);
    fp += 1;
  }
  if (departmentIdQ && z.string().uuid().safeParse(departmentIdQ).success) {
    filters.push(
      `EXISTS (SELECT 1 FROM user_departments ud2 WHERE ud2.user_id = u.id AND ud2.department_id = $${fp}::uuid)`
    );
    filterParams.push(departmentIdQ);
    fp += 1;
  }
  const filterSql = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

  const res = await db.query<{
    id: string;
    email: string;
    name: string;
    role: string;
    department_assignments: Array<{
      departmentId: string;
      departmentName: string;
      role: "admin" | "manager" | "member";
      isPrimary: boolean;
    }>;
    created_at: Date;
  }>(
    `
    SELECT
      u.id::text,
      u.email,
      u.name,
      u.role,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'departmentId', ud.department_id::text,
            'departmentName', d.name,
            'role', ud.role,
            'isPrimary', ud.is_primary
          )
          ORDER BY ud.is_primary DESC, d.name ASC
        ) FILTER (WHERE ud.id IS NOT NULL),
        '[]'::json
      ) AS department_assignments,
      u.created_at
    FROM users u
    LEFT JOIN user_departments ud ON ud.user_id = u.id
    LEFT JOIN departments d ON d.id = ud.department_id
    ${filterSql}
    GROUP BY u.id, u.email, u.name, u.role, u.created_at
    ORDER BY u.name ASC
    `,
    filterParams
  );

  return NextResponse.json({
    users: res.rows.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      role: r.role,
      departmentAssignments: r.department_assignments,
      departmentId:
        r.department_assignments.find((x) => x.isPrimary)?.departmentId ??
        r.department_assignments[0]?.departmentId ??
        null,
      departmentName:
        r.department_assignments.find((x) => x.isPrimary)?.departmentName ??
        r.department_assignments[0]?.departmentName ??
        null,
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

  const { email, password, name, role, departmentAssignments } = parsed.data;
  const policyMsg = validatePasswordPolicy(password);
  if (policyMsg) {
    return NextResponse.json({ message: policyMsg }, { status: 400 });
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const emailLower = email.toLowerCase();
  const normalized = departmentAssignments.map((a, i) => ({
    ...a,
    isPrimary: Boolean(a.isPrimary)
  }));
  if (normalized.length > 0 && !normalized.some((a) => a.isPrimary)) {
    normalized[0]!.isPrimary = true;
  }
  if (normalized.filter((a) => a.isPrimary).length > 1) {
    return NextResponse.json({ message: "주 소속 부서는 하나만 선택할 수 있습니다." }, { status: 400 });
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const ins = await client.query<{ id: string }>(
      `
      INSERT INTO users (email, password_hash, name, role, is_temp_password)
      VALUES ($1, $2, $3, $4, TRUE)
      RETURNING id::text
      `,
      [emailLower, passwordHash, name, role]
    );
    const userId = ins.rows[0].id;
    for (const a of normalized) {
      await client.query(
        `
        INSERT INTO user_departments (user_id, department_id, is_primary, role)
        VALUES ($1::uuid, $2::uuid, $3, $4)
        ON CONFLICT (user_id, department_id) DO UPDATE
        SET is_primary = EXCLUDED.is_primary, role = EXCLUDED.role
        `,
        [userId, a.departmentId, a.isPrimary, a.role]
      );
    }
    await client.query("COMMIT");
    return NextResponse.json({ id: userId });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[POST /api/admin/users]", e);
    return NextResponse.json({ message: "사용자를 만들지 못했습니다. 이메일 중복 여부를 확인해 주세요." }, { status: 500 });
  } finally {
    client.release();
  }
}
