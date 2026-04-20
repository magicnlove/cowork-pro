import { NextRequest, NextResponse } from "next/server";
import { denyUnlessAdmin } from "@/lib/require-admin";
import { runFileRetentionCleanup } from "@/lib/file-retention";
import { db } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/session";
import { getUserContext } from "@/lib/user-context";

function isCronAuthorized(request: NextRequest): boolean {
  const secret = process.env.CLEANUP_CRON_SECRET;
  if (!secret) {
    return false;
  }
  return request.headers.get("x-cleanup-secret") === secret;
}

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

  const res = await db.query<{ id: string; run_at: Date; files_deleted: number }>(
    `
    SELECT id::text, run_at, files_deleted
    FROM cleanup_logs
    ORDER BY run_at DESC
    LIMIT 200
    `
  );
  return NextResponse.json({
    logs: res.rows.map((r) => ({
      id: r.id,
      runAt: r.run_at.toISOString(),
      filesDeleted: r.files_deleted
    }))
  });
}

export async function POST(request: NextRequest) {
  const cronOk = isCronAuthorized(request);
  if (!cronOk) {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
    }
    const ctx = await getUserContext(session.sub);
    const denied = denyUnlessAdmin(ctx);
    if (denied) {
      return denied;
    }
  }

  const { filesDeleted } = await runFileRetentionCleanup();
  return NextResponse.json({ ok: true, filesDeleted });
}
