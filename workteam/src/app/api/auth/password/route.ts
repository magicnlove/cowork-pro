export const dynamic = "force-dynamic";

import bcrypt from "bcrypt";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  PASSWORD_CHANGE_REQUIRED_COOKIE,
  passwordChangeRequiredCookieOptions
} from "@/lib/auth";
import { db } from "@/lib/db";
import { validatePasswordPolicy } from "@/lib/password-policy";
import { getSessionFromRequest } from "@/lib/session";

const bodySchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(1, "새 비밀번호를 입력해주세요.")
});

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." }, { status: 400 });
  }

  const { currentPassword, newPassword } = parsed.data;

  const policyMsg = validatePasswordPolicy(newPassword);
  if (policyMsg) {
    return NextResponse.json({ message: policyMsg }, { status: 400 });
  }

  const userRes = await db.query<{ password_hash: string; is_temp_password: boolean }>(
    `SELECT password_hash, is_temp_password FROM users WHERE id = $1::uuid LIMIT 1`,
    [session.sub]
  );
  const row = userRes.rows[0];
  if (!row) {
    return NextResponse.json({ message: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  if (row.is_temp_password) {
    const sameAsBefore = await bcrypt.compare(newPassword, row.password_hash);
    if (sameAsBefore) {
      return NextResponse.json({ message: "이전 비밀번호와 달라야 합니다." }, { status: 400 });
    }
  } else {
    const pwd = currentPassword?.trim();
    if (!pwd) {
      return NextResponse.json({ message: "현재 비밀번호를 입력해주세요." }, { status: 400 });
    }
    if (pwd === newPassword) {
      return NextResponse.json({ message: "이전 비밀번호와 달라야 합니다." }, { status: 400 });
    }
    const match = await bcrypt.compare(pwd, row.password_hash);
    if (!match) {
      return NextResponse.json({ message: "현재 비밀번호가 올바르지 않습니다." }, { status: 400 });
    }
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await db.query(
    `UPDATE users SET password_hash = $2::varchar, is_temp_password = FALSE WHERE id = $1::uuid`,
    [session.sub, newHash]
  );

  const res = NextResponse.json({ ok: true });
  res.cookies.set(PASSWORD_CHANGE_REQUIRED_COOKIE, "", {
    ...passwordChangeRequiredCookieOptions,
    maxAge: 0
  });
  return res;
}
