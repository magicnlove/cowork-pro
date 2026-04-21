export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const bodySchema = z.object({
  name: z.string().min(1, "이름을 입력해주세요."),
  email: z.string().email("유효한 이메일을 입력해주세요.")
});

/**
 * 공개: 이름+이메일 일치 시에만 요청 저장 (계정 존재 여부 노출 최소화)
 */
export async function POST(request: NextRequest) {
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

  const name = parsed.data.name.trim();
  const email = parsed.data.email.trim().toLowerCase();

  const userRes = await db.query<{ id: string }>(
    `SELECT id::text FROM users WHERE lower(email) = $1 AND name = $2 LIMIT 1`,
    [email, name]
  );
  const user = userRes.rows[0];

  if (!user) {
    return NextResponse.json(
      { message: "입력하신 정보와 일치하는 계정을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  try {
    await db.query(
      `
      INSERT INTO password_reset_requests (user_id, status)
      VALUES ($1::uuid, 'pending')
      `,
      [user.id]
    );
  } catch (e: unknown) {
    const code = typeof e === "object" && e !== null && "code" in e ? String((e as { code?: string }).code) : "";
    if (code === "23505") {
      return NextResponse.json(
        { message: "이미 처리 대기 중인 재설정 요청이 있습니다. 관리자에게 문의해 주세요." },
        { status: 409 }
      );
    }
    console.error("[password-reset-request]", e);
    return NextResponse.json({ message: "요청을 저장하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: "관리자에게 요청이 전달되었습니다" });
}
