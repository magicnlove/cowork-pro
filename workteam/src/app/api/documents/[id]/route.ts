export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { insertAuditLog, recordAuditAndActivity } from "@/lib/archive-audit";
import {
  AccessError,
  assertDocumentAccess,
  getWorkspaceRole,
  requireWorkspaceRole,
  workspaceRoleAtLeast
} from "@/lib/archive-scope";
import { buildDocumentEditorEmbedUrl } from "@/lib/document-editor";
import { db } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/session";
import { getUserContext } from "@/lib/user-context";
import type { DocumentDetailDTO } from "@/types/archive";

const FOLDER_RE = /^(in_progress|completed|reference)(\/[^/]+)?$/;

const patchSchema = z
  .object({
    title: z.string().min(1).max(500).optional(),
    folder: z.string().min(1).max(500).optional()
  })
  .refine((o) => o.title !== undefined || o.folder !== undefined, {
    message: "empty"
  });

type RouteCtx = { params: Promise<{ id: string }> };

async function fetchDocumentRow(id: string) {
  const res = await db.query<{
    id: string;
    title: string;
    workspace_id: string;
    folder: string;
    created_by: string;
    created_at: Date;
    body: string;
  }>(
    `
    SELECT
      d.id::text,
      d.title,
      d.workspace_id::text,
      d.folder,
      d.created_by::text,
      d.created_at,
      COALESCE(lv.body, '') AS body
    FROM documents d
    LEFT JOIN LATERAL (
      SELECT dv.body
      FROM document_versions dv
      WHERE dv.document_id = d.id
      ORDER BY dv.version_number DESC
      LIMIT 1
    ) lv ON TRUE
    WHERE d.id = $1::uuid
    LIMIT 1
    `,
    [id]
  );
  return res.rows[0] ?? null;
}

export async function GET(_request: NextRequest, context: RouteCtx) {
  const session = getSessionFromRequest(_request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const ctx = await getUserContext(session.sub);
  if (!ctx) {
    return NextResponse.json({ message: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const { role } = await assertDocumentAccess(ctx.id, id, "viewer");
    const row = await fetchDocumentRow(id);
    if (!row) {
      return NextResponse.json({ message: "문서를 찾을 수 없습니다." }, { status: 404 });
    }

    await recordAuditAndActivity({
      userId: ctx.id,
      auditAction: "document_viewed",
      targetId: id,
      entityId: id,
      entityName: row.title
    });

    const payload: DocumentDetailDTO = {
      id: row.id,
      title: row.title,
      workspaceId: row.workspace_id,
      folder: row.folder,
      body: row.body,
      createdBy: row.created_by,
      createdAt: row.created_at.toISOString(),
      myRole: role,
      editor: {
        embedUrl: buildDocumentEditorEmbedUrl({ documentId: id, viewerUserId: ctx.id })
      }
    };

    return NextResponse.json({ document: payload });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    throw e;
  }
}

export async function PATCH(request: NextRequest, context: RouteCtx) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const ctx = await getUserContext(session.sub);
  if (!ctx) {
    return NextResponse.json({ message: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "잘못된 JSON입니다." }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }

  try {
    const row = await fetchDocumentRow(id);
    if (!row) {
      return NextResponse.json({ message: "문서를 찾을 수 없습니다." }, { status: 404 });
    }

    const wsRole = await getWorkspaceRole(ctx.id, row.workspace_id);
    if (!wsRole || !workspaceRoleAtLeast(wsRole, "editor")) {
      throw new AccessError(403, "문서를 수정할 권한이 없습니다.");
    }

    if (parsed.data.folder !== undefined && !FOLDER_RE.test(parsed.data.folder)) {
      return NextResponse.json(
        {
          message:
            "폴더는 in_progress, completed, reference 중 하나이거나, 한 단계 하위만 허용됩니다."
        },
        { status: 400 }
      );
    }

    const title = parsed.data.title ?? row.title;
    const folder = parsed.data.folder ?? row.folder;

    await db.query(
      `
      UPDATE documents
      SET title = $2, folder = $3
      WHERE id = $1::uuid
      `,
      [id, title, folder]
    );

    const titleChanged = parsed.data.title !== undefined;
    const folderChanged = parsed.data.folder !== undefined;

    if (titleChanged || folderChanged) {
      await recordAuditAndActivity({
        userId: ctx.id,
        auditAction: "document_updated",
        targetId: id,
        entityId: id,
        entityName: title
      });
    }

    return NextResponse.json({ ok: true });
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

  const { id } = await context.params;

  try {
    const { workspaceId } = await assertDocumentAccess(ctx.id, id, "viewer");
    await requireWorkspaceRole(ctx.id, workspaceId, "owner");

    await db.query(`DELETE FROM documents WHERE id = $1::uuid`, [id]);
    await insertAuditLog({
      userId: ctx.id,
      action: "document_deleted",
      targetId: id
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    throw e;
  }
}
