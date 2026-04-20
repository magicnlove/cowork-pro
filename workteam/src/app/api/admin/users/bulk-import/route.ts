import bcrypt from "bcrypt";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { denyUnlessAdmin } from "@/lib/require-admin";
import { validatePasswordPolicy } from "@/lib/password-policy";
import { getSessionFromRequest } from "@/lib/session";
import { getUserContext } from "@/lib/user-context";

const roleSchema = z.enum(["admin", "manager", "member"]);

const rowSchema = z.object({
  rowIndex: z.number().int().min(1),
  email: z.string(),
  password: z.string(),
  name: z.string(),
  role: z.string(),
  departments: z.string().optional().default("")
});

const bodySchema = z.object({
  dryRun: z.boolean().optional().default(false),
  rows: z.array(rowSchema).max(500)
});

type DeptRow = { id: string; name: string; code: string };

async function loadDepartments(): Promise<DeptRow[]> {
  const res = await db.query<DeptRow>(
    `SELECT id::text, name, code FROM departments ORDER BY name ASC`
  );
  return res.rows;
}

function buildDeptLookup(depts: DeptRow[]) {
  const byName = new Map<string, string>();
  const byCode = new Map<string, string>();
  for (const d of depts) {
    byName.set(d.name.trim().toLowerCase(), d.id);
    byCode.set(d.code.trim().toLowerCase(), d.id);
  }
  return { byName, byCode };
}

function resolveDepartmentIds(
  raw: string,
  lookup: ReturnType<typeof buildDeptLookup>
): { ids: string[]; error: string | null } {
  const parts = raw
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return { ids: [], error: null };
  }
  const ids: string[] = [];
  for (const p of parts) {
    const key = p.toLowerCase();
    const id = lookup.byName.get(key) ?? lookup.byCode.get(key);
    if (!id) {
      return { ids: [], error: `부서를 찾을 수 없습니다: ${p}` };
    }
    ids.push(id);
  }
  return { ids, error: null };
}

type ValidatedRow = {
  rowIndex: number;
  emailLower: string;
  password: string;
  name: string;
  role: "admin" | "manager" | "member";
  departmentIds: string[];
};

function validateOneRow(
  r: z.infer<typeof rowSchema>,
  lookup: ReturnType<typeof buildDeptLookup>
): { ok: true; data: ValidatedRow } | { ok: false; reason: string } {
  const emailTrim = r.email.trim();
  if (!emailTrim) {
    return { ok: false, reason: "이메일이 비어 있습니다." };
  }
  const emailParsed = z.string().email().safeParse(emailTrim);
  if (!emailParsed.success) {
    return { ok: false, reason: "이메일 형식이 올바르지 않습니다." };
  }
  const emailLower = emailTrim.toLowerCase();

  if (!r.password?.trim()) {
    return { ok: false, reason: "임시비밀번호가 비어 있습니다." };
  }
  const pwMsg = validatePasswordPolicy(r.password);
  if (pwMsg) {
    return { ok: false, reason: pwMsg };
  }

  const nameTrim = r.name.trim();
  if (!nameTrim) {
    return { ok: false, reason: "이름이 비어 있습니다." };
  }
  if (nameTrim.length > 100) {
    return { ok: false, reason: "이름은 100자 이하여야 합니다." };
  }

  const roleTrim = r.role.trim().toLowerCase();
  const roleParsed = roleSchema.safeParse(roleTrim);
  if (!roleParsed.success) {
    return { ok: false, reason: "역할은 admin, manager, member 중 하나여야 합니다." };
  }

  const { ids: departmentIds, error: deptErr } = resolveDepartmentIds(r.departments ?? "", lookup);
  if (deptErr) {
    return { ok: false, reason: deptErr };
  }

  return {
    ok: true,
    data: {
      rowIndex: r.rowIndex,
      emailLower,
      password: r.password,
      name: nameTrim,
      role: roleParsed.data,
      departmentIds
    }
  };
}

async function insertUserRow(data: ValidatedRow): Promise<{ ok: true } | { ok: false; reason: string }> {
  const passwordHash = await bcrypt.hash(data.password, 12);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const ins = await client.query<{ id: string }>(
      `
      INSERT INTO users (email, password_hash, name, role, is_temp_password)
      VALUES ($1, $2, $3, $4, TRUE)
      RETURNING id::text
      `,
      [data.emailLower, passwordHash, data.name, data.role]
    );
    const userId = ins.rows[0]!.id;
    const assignments = data.departmentIds.map((departmentId, i) => ({
      departmentId,
      isPrimary: i === 0,
      role: data.role
    }));
    for (const a of assignments) {
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
    return { ok: true };
  } catch (e: unknown) {
    await client.query("ROLLBACK");
    const err = e as { code?: string };
    if (err.code === "23505") {
      return { ok: false, reason: "이미 등록된 이메일입니다." };
    }
    console.error("[bulk-import] insert failed", e);
    return { ok: false, reason: "저장 중 오류가 발생했습니다." };
  } finally {
    client.release();
  }
}

type PreviewRow = {
  rowIndex: number;
  email: string;
  name: string;
  role: string;
  departments: string;
  error: string | null;
};

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

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const { dryRun, rows } = parsed.data;
  const sorted = [...rows].sort((a, b) => a.rowIndex - b.rowIndex);
  const depts = await loadDepartments();
  const lookup = buildDeptLookup(depts);

  const firstOccurrence = new Map<string, number>();
  for (const r of sorted) {
    const k = r.email.trim().toLowerCase();
    if (!k) {
      continue;
    }
    if (!firstOccurrence.has(k)) {
      firstOccurrence.set(k, r.rowIndex);
    }
  }

  const existingRes = await db.query<{ email: string }>(`SELECT lower(email) AS email FROM users`);
  const existingEmails = new Set(existingRes.rows.map((x) => x.email));

  const preview: PreviewRow[] = [];
  const failures: Array<{ rowIndex: number; reason: string }> = [];
  let successCount = 0;

  for (const r of sorted) {
    const emailKey = r.email.trim().toLowerCase();
    const firstIdx = emailKey ? firstOccurrence.get(emailKey) : undefined;
    const dupMsg = "파일 내 이메일이 중복되었습니다.";
    if (emailKey && firstIdx !== undefined && firstIdx !== r.rowIndex) {
      preview.push({
        rowIndex: r.rowIndex,
        email: r.email.trim(),
        name: r.name.trim(),
        role: r.role.trim(),
        departments: r.departments ?? "",
        error: dupMsg
      });
      failures.push({ rowIndex: r.rowIndex, reason: dupMsg });
      continue;
    }

    const v = validateOneRow(r, lookup);
    if (!v.ok) {
      preview.push({
        rowIndex: r.rowIndex,
        email: r.email.trim(),
        name: r.name.trim(),
        role: r.role.trim(),
        departments: r.departments ?? "",
        error: v.reason
      });
      failures.push({ rowIndex: r.rowIndex, reason: v.reason });
      continue;
    }

    if (existingEmails.has(v.data.emailLower)) {
      const msg = "이미 등록된 이메일입니다.";
      preview.push({
        rowIndex: r.rowIndex,
        email: v.data.emailLower,
        name: v.data.name,
        role: v.data.role,
        departments: r.departments ?? "",
        error: msg
      });
      failures.push({ rowIndex: r.rowIndex, reason: msg });
      continue;
    }

    if (dryRun) {
      existingEmails.add(v.data.emailLower);
      successCount += 1;
      preview.push({
        rowIndex: r.rowIndex,
        email: v.data.emailLower,
        name: v.data.name,
        role: v.data.role,
        departments: r.departments ?? "",
        error: null
      });
      continue;
    }

    const ins = await insertUserRow(v.data);
    if (ins.ok) {
      existingEmails.add(v.data.emailLower);
      successCount += 1;
      preview.push({
        rowIndex: r.rowIndex,
        email: v.data.emailLower,
        name: v.data.name,
        role: v.data.role,
        departments: r.departments ?? "",
        error: null
      });
    } else {
      preview.push({
        rowIndex: r.rowIndex,
        email: v.data.emailLower,
        name: v.data.name,
        role: v.data.role,
        departments: r.departments ?? "",
        error: ins.reason
      });
      failures.push({ rowIndex: r.rowIndex, reason: ins.reason });
    }
  }

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      preview,
      successCount,
      failCount: failures.length
    });
  }

  return NextResponse.json({
    dryRun: false,
    preview,
    successCount,
    failCount: failures.length,
    failures
  });
}
