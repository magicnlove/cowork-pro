export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  AccessError,
  assertWorkspaceAccess,
  requireWorkspaceRole
} from "@/lib/archive-scope";
import { db } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/session";
import { getUserContext } from "@/lib/user-context";
import type { WorkspaceRole, WorkspaceType } from "@/types/archive";

type RouteCtx = { params: Promise<{ workspaceId: string }> };

export async function GET(_request: NextRequest, context: RouteCtx) {
  const session = getSessionFromRequest(_request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const ctx = await getUserContext(session.sub);
  if (!ctx) {
    return NextResponse.json({ message: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  const { workspaceId } = await context.params;

  try {
    const role = await assertWorkspaceAccess(ctx.id, workspaceId);

    const ws = await db.query<{
      id: string;
      name: string;
      type: string;
      created_by: string;
      created_at: Date;
    }>(
      `
      SELECT id::text, name, type, created_by::text, created_at
      FROM workspaces
      WHERE id = $1::uuid
      LIMIT 1
      `,
      [workspaceId]
    );
    const w = ws.rows[0];
    if (!w) {
      return NextResponse.json({ message: "찾을 수 없습니다." }, { status: 404 });
    }

    const members = await db.query<{
      user_id: string;
      name: string;
      email: string;
      role: WorkspaceRole;
    }>(
      `
      SELECT u.id::text AS user_id, u.name, u.email, wm.role
      FROM workspace_members wm
      INNER JOIN users u ON u.id = wm.user_id
      WHERE wm.workspace_id = $1::uuid
      ORDER BY
        CASE wm.role WHEN 'owner' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END,
        u.name ASC
      `,
      [workspaceId]
    );

    return NextResponse.json({
      workspace: {
        id: w.id,
        name: w.name,
        type: w.type as WorkspaceType,
        createdBy: w.created_by,
        createdAt: w.created_at.toISOString(),
        myRole: role
      },
      members: members.rows.map((m) => ({
        userId: m.user_id,
        name: m.name,
        email: m.email,
        role: m.role
      }))
    });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    throw e;
  }
}

export async function DELETE(_request: NextRequest, context: RouteCtx) {
  const session = getSessionFromRequest(_request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const ctx = await getUserContext(session.sub);
  if (!ctx) {
    return NextResponse.json({ message: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  const { workspaceId } = await context.params;

  try {
    await requireWorkspaceRole(ctx.id, workspaceId, "owner");
    const cnt = await db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM documents WHERE workspace_id = $1::uuid`,
      [workspaceId]
    );
    const n = Number.parseInt(cnt.rows[0]?.n ?? "0", 10) || 0;
    await db.query(`DELETE FROM workspaces WHERE id = $1::uuid`, [workspaceId]);
    return NextResponse.json({ ok: true, deletedDocumentCount: n });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    throw e;
  }
}
