export const dynamic = "force-dynamic";

import bcrypt from "bcrypt";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { denyUnlessAdmin } from "@/lib/require-admin";
import { generateSecureTempPassword } from "@/lib/password-policy";
import { getSessionFromRequest } from "@/lib/session";
import { sendTempPasswordEmail } from "@/lib/smtp-mail";
import { getUserContext } from "@/lib/user-context";

type RouteCtx = { params: { id: string } };

export async function POST(_request: NextRequest, context: RouteCtx) {
  const session = getSessionFromRequest(_request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const ctx = await getUserContext(session.sub);
  const denied = denyUnlessAdmin(ctx);
  if (denied) {
    return denied;
  }

  const userId = context.params.id;

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const userRes = await client.query<{ email: string; name: string; role: string }>(
      `SELECT email, name, role FROM users WHERE id = $1::uuid LIMIT 1 FOR UPDATE`,
      [userId]
    );
    const u = userRes.rows[0];
    if (!u) {
      await client.query("ROLLBACK");
      return NextResponse.json({ message: "사용자를 찾을 수 없습니다." }, { status: 404 });
    }
    if (u.role === "admin") {
      await client.query("ROLLBACK");
      return NextResponse.json({ message: "admin 계정에는 임시 비밀번호를 발급할 수 없습니다." }, { status: 403 });
    }

    const tempPlain = generateSecureTempPassword();
    const hash = await bcrypt.hash(tempPlain, 12);

    await client.query(
      `UPDATE users SET password_hash = $2::varchar, is_temp_password = TRUE WHERE id = $1::uuid`,
      [userId, hash]
    );

    await client.query("COMMIT");

    let emailSent = false;
    try {
      const sent = await sendTempPasswordEmail(u.email, u.name, tempPlain, "admin_issue");
      emailSent = sent.sent;
    } catch (e) {
      console.error("[issue-temp-password] email failed", e);
    }

    return NextResponse.json({
      ok: true,
      tempPassword: tempPlain,
      emailSent,
      userEmail: u.email
    });
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      void 0;
    }
    console.error("[issue-temp-password]", e);
    return NextResponse.json({ message: "임시 비밀번호 발급에 실패했습니다." }, { status: 500 });
  } finally {
    client.release();
  }
}
