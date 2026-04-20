import bcrypt from "bcrypt";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { denyUnlessAdmin } from "@/lib/require-admin";
import { generateSecureTempPassword } from "@/lib/password-policy";
import { getSessionFromRequest } from "@/lib/session";
import { sendTempPasswordEmail } from "@/lib/smtp-mail";
import { getUserContext } from "@/lib/user-context";

type RouteCtx = { params: { id: string } };

export async function POST(request: NextRequest, context: RouteCtx) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const ctx = await getUserContext(session.sub);
  const denied = denyUnlessAdmin(ctx);
  if (denied) {
    return denied;
  }

  const requestId = context.params.id;

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const pend = await client.query<{ user_id: string }>(
      `
      SELECT user_id::text
      FROM password_reset_requests
      WHERE id = $1::uuid AND status = 'pending'
      FOR UPDATE
      `,
      [requestId]
    );

    if (!pend.rows[0]) {
      await client.query("ROLLBACK");
      return NextResponse.json({ message: "처리할 수 있는 대기 요청이 없습니다." }, { status: 400 });
    }

    const userId = pend.rows[0].user_id;

    const userRes = await client.query<{ email: string; name: string }>(
      `SELECT email, name FROM users WHERE id = $1::uuid LIMIT 1 FOR UPDATE`,
      [userId]
    );
    const u = userRes.rows[0];
    if (!u) {
      await client.query("ROLLBACK");
      return NextResponse.json({ message: "사용자를 찾을 수 없습니다." }, { status: 404 });
    }

    const tempPlain = generateSecureTempPassword();
    const hash = await bcrypt.hash(tempPlain, 12);

    await client.query(
      `UPDATE users SET password_hash = $2::varchar, is_temp_password = TRUE WHERE id = $1::uuid`,
      [userId, hash]
    );
    await client.query(
      `UPDATE password_reset_requests SET status = 'completed' WHERE id = $1::uuid`,
      [requestId]
    );

    await client.query("COMMIT");

    let emailSent = false;
    try {
      const sent = await sendTempPasswordEmail(u.email, u.name, tempPlain);
      emailSent = sent.sent;
    } catch (e) {
      console.error("[approve reset] email failed", e);
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
    console.error("[approve reset]", e);
    return NextResponse.json({ message: "승인 처리에 실패했습니다." }, { status: 500 });
  } finally {
    client.release();
  }
}
