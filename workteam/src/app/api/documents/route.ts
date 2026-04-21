export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { recordAuditAndActivity } from "@/lib/archive-audit";
import { AccessError, requireWorkspaceRole } from "@/lib/archive-scope";
import { db } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/session";
import { getUserContext } from "@/lib/user-context";
import type { DocumentDTO } from "@/types/archive";

const FOLDER_RE = /^(in_progress|completed|reference)(\/[^/]+)?$/;

const postSchema = z.object({
  title: z.string().min(1).max(500),
  workspaceId: z.string().uuid(),
  folder: z.string().min(1).max(500)
});

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const ctx = await getUserContext(session.sub);
  if (!ctx) {
    return NextResponse.json({ message: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  const workspaceId = request.nextUrl.searchParams.get("workspaceId");

  try {
    if (workspaceId) {
      await requireWorkspaceRole(ctx.id, workspaceId, "viewer");
    }

    const params: unknown[] = [ctx.id];
    let wClause = "";
    if (workspaceId) {
      wClause = "AND d.workspace_id = $2::uuid";
      params.push(workspaceId);
    }

    const res = await db.query<{
      id: string;
      title: string;
      workspace_id: string;
      folder: string;
      created_by: string;
      created_at: Date;
    }>(
      `
      SELECT
        d.id::text,
        d.title,
        d.workspace_id::text,
        d.folder,
        d.created_by::text,
        d.created_at
      FROM documents d
      INNER JOIN workspace_members wm
        ON wm.workspace_id = d.workspace_id AND wm.user_id = $1::uuid
      WHERE 1=1 ${wClause}
      ORDER BY d.created_at DESC
      LIMIT 200
      `,
      params
    );

    const items: DocumentDTO[] = res.rows.map((r) => ({
      id: r.id,
      title: r.title,
      workspaceId: r.workspace_id,
      folder: r.folder,
      createdBy: r.created_by,
      createdAt: r.created_at.toISOString()
    }));

    return NextResponse.json({ documents: items });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    throw e;
  }
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

  const { title, workspaceId, folder } = parsed.data;

  if (!FOLDER_RE.test(folder)) {
    return NextResponse.json(
      {
        message:
          "폴더는 in_progress, completed, reference 중 하나이거나, 한 단계 하위만 허용됩니다 (예: in_progress/부서명)."
      },
      { status: 400 }
    );
  }

  try {
    await requireWorkspaceRole(ctx.id, workspaceId, "editor");

    const client = await db.connect();
    let documentId: string;
    try {
      await client.query("BEGIN");
      const ins = await client.query<{ id: string }>(
        `
        INSERT INTO documents (title, workspace_id, folder, created_by)
        VALUES ($1, $2::uuid, $3, $4::uuid)
        RETURNING id::text
        `,
        [title, workspaceId, folder, ctx.id]
      );
      documentId = ins.rows[0]?.id ?? "";
      if (!documentId) {
        throw new Error("insert failed");
      }
      await client.query(
        `
        INSERT INTO document_versions (document_id, version_number, change_summary, created_by, body)
        VALUES ($1::uuid, 1, $2, $3::uuid, $4)
        `,
        [documentId, "Initial", ctx.id, ""]
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }

    await recordAuditAndActivity({
      userId: ctx.id,
      auditAction: "document_created",
      targetId: documentId,
      entityId: documentId,
      entityName: title
    });

    return NextResponse.json({ ok: true, documentId });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    throw e;
  }
}
