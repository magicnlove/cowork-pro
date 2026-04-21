export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { recordAuditAndActivity } from "@/lib/archive-audit";
import { AccessError, getWorkspaceRole, requireWorkspaceRole } from "@/lib/archive-scope";
import { db } from "@/lib/db";
import { getVisibleDepartmentIds } from "@/lib/org-scope";
import { getSessionFromRequest } from "@/lib/session";
import { getUserContext } from "@/lib/user-context";
import type { WorkspaceDTO, WorkspaceRole, WorkspaceType } from "@/types/archive";

const postSchema = z.union([
  z.object({
    mode: z.literal("create"),
    workspaceType: z.literal("org"),
    departmentId: z.string().uuid()
  }),
  z.object({
    mode: z.literal("create"),
    workspaceType: z.literal("custom"),
    name: z.string().min(1).max(255)
  }),
  z.object({
    mode: z.literal("setMember"),
    workspaceId: z.string().uuid(),
    userId: z.string().uuid(),
    role: z.enum(["viewer", "editor", "owner"])
  }),
  z.object({
    mode: z.literal("removeMember"),
    workspaceId: z.string().uuid(),
    userId: z.string().uuid()
  })
]);

function mapRow(r: {
  id: string;
  name: string;
  type: string;
  created_by: string;
  created_at: Date;
  my_role: WorkspaceRole;
}): WorkspaceDTO {
  return {
    id: r.id,
    name: r.name,
    type: r.type as WorkspaceType,
    createdBy: r.created_by,
    createdAt: r.created_at.toISOString(),
    myRole: r.my_role
  };
}

export async function GET(_request: NextRequest) {
  const session = getSessionFromRequest(_request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const ctx = await getUserContext(session.sub);
  if (!ctx) {
    return NextResponse.json({ message: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  const res = await db.query<{
    id: string;
    name: string;
    type: string;
    created_by: string;
    created_at: Date;
    my_role: WorkspaceRole;
  }>(
    `
    SELECT
      w.id::text,
      w.name,
      w.type,
      w.created_by::text,
      w.created_at,
      wm.role AS my_role
    FROM workspaces w
    INNER JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = $1::uuid
    ORDER BY w.created_at DESC
    `,
    [ctx.id]
  );

  return NextResponse.json({ workspaces: res.rows.map(mapRow) });
}

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const ctx = await getUserContext(session.sub);
  if (!ctx) {
    return NextResponse.json({ message: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "잘못된 JSON입니다." }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }

  try {
    if (parsed.data.mode === "create") {
      let workspaceName: string;
      const workspaceType = parsed.data.workspaceType;

      if (parsed.data.workspaceType === "org") {
        const { departmentId } = parsed.data;
        if (ctx.role !== "admin") {
          const scope = await getVisibleDepartmentIds(ctx);
          if (!scope.includes(departmentId)) {
            return NextResponse.json(
              { message: "선택한 부서에 접근할 수 없습니다." },
              { status: 403 }
            );
          }
        }
        const dr = await db.query<{ name: string }>(
          `SELECT name FROM departments WHERE id = $1::uuid LIMIT 1`,
          [departmentId]
        );
        const n = dr.rows[0]?.name;
        if (!n) {
          return NextResponse.json({ message: "부서를 찾을 수 없습니다." }, { status: 404 });
        }
        workspaceName = n;
      } else {
        workspaceName = parsed.data.name.trim();
      }

      const ins = await db.query<{ id: string }>(
        `
        INSERT INTO workspaces (name, type, created_by)
        VALUES ($1, $2, $3::uuid)
        RETURNING id::text
        `,
        [workspaceName, workspaceType, ctx.id]
      );
      const wsId = ins.rows[0]?.id;
      if (!wsId) {
        return NextResponse.json({ message: "생성에 실패했습니다." }, { status: 500 });
      }
      await db.query(
        `
        INSERT INTO workspace_members (workspace_id, user_id, role)
        VALUES ($1::uuid, $2::uuid, 'owner')
        `,
        [wsId, ctx.id]
      );
      return NextResponse.json({ ok: true, workspaceId: wsId });
    }

    if (parsed.data.mode === "setMember") {
      const { workspaceId, userId, role } = parsed.data;
      await requireWorkspaceRole(ctx.id, workspaceId, "owner");

      const otherOwners = await db.query<{ n: string }>(
        `
        SELECT COUNT(*)::text AS n
        FROM workspace_members
        WHERE workspace_id = $1::uuid AND role = 'owner' AND user_id <> $2::uuid
        `,
        [workspaceId, userId]
      );
      const n = Number.parseInt(otherOwners.rows[0]?.n ?? "0", 10) || 0;
      const currentRole = await getWorkspaceRole(userId, workspaceId);
      if (currentRole === "owner" && role !== "owner" && n < 1) {
        return NextResponse.json(
          { message: "워크스페이스에는 최소 한 명의 소유자(owner)가 필요합니다." },
          { status: 400 }
        );
      }

      await db.query(
        `
        INSERT INTO workspace_members (workspace_id, user_id, role)
        VALUES ($1::uuid, $2::uuid, $3)
        ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role
        `,
        [workspaceId, userId, role]
      );

      const wn = await db.query<{ name: string }>(
        `SELECT name FROM workspaces WHERE id = $1::uuid LIMIT 1`,
        [workspaceId]
      );
      const wsName = wn.rows[0]?.name ?? "워크스페이스";
      await recordAuditAndActivity({
        userId: ctx.id,
        auditAction: "workspace_member_role_changed",
        targetId: workspaceId,
        entityId: workspaceId,
        entityName: `${wsName} · 멤버 권한 변경`
      });
      return NextResponse.json({ ok: true });
    }

    const { workspaceId, userId } = parsed.data;
    await requireWorkspaceRole(ctx.id, workspaceId, "owner");

    const targetRole = await getWorkspaceRole(userId, workspaceId);
    if (!targetRole) {
      return NextResponse.json({ message: "대상 사용자가 멤버가 아닙니다." }, { status: 400 });
    }
    if (targetRole === "owner") {
      const otherOwners = await db.query<{ n: string }>(
        `
        SELECT COUNT(*)::text AS n
        FROM workspace_members
        WHERE workspace_id = $1::uuid AND role = 'owner' AND user_id <> $2::uuid
        `,
        [workspaceId, userId]
      );
      const n = Number.parseInt(otherOwners.rows[0]?.n ?? "0", 10) || 0;
      if (n < 1) {
        return NextResponse.json(
          { message: "마지막 소유자(owner)는 제거할 수 없습니다." },
          { status: 400 }
        );
      }
    }

    await db.query(
      `DELETE FROM workspace_members WHERE workspace_id = $1::uuid AND user_id = $2::uuid`,
      [workspaceId, userId]
    );

    const wn = await db.query<{ name: string }>(
      `SELECT name FROM workspaces WHERE id = $1::uuid LIMIT 1`,
      [workspaceId]
    );
    const wsName = wn.rows[0]?.name ?? "워크스페이스";
    await recordAuditAndActivity({
      userId: ctx.id,
      auditAction: "workspace_member_removed",
      targetId: workspaceId,
      entityId: workspaceId,
      entityName: `${wsName} · 멤버 제거`
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    throw e;
  }
}
