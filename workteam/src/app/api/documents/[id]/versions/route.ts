import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { recordAuditAndActivity } from "@/lib/archive-audit";
import { AccessError, assertDocumentAccess, getWorkspaceRole, workspaceRoleAtLeast } from "@/lib/archive-scope";
import { db } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/session";
import { getUserContext } from "@/lib/user-context";
import type { DocumentVersionDTO } from "@/types/archive";

const postSchema = z.object({
  body: z.string().max(500000),
  changeSummary: z.string().max(2000).optional().default("")
});

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteCtx) {
  const session = getSessionFromRequest(_request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const ctx = await getUserContext(session.sub);
  if (!ctx) {
    return NextResponse.json({ message: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  const { id: documentId } = await context.params;

  try {
    await assertDocumentAccess(ctx.id, documentId, "viewer");

    const res = await db.query<{
      id: string;
      document_id: string;
      version_number: number;
      change_summary: string | null;
      body: string;
      created_by: string;
      created_at: Date;
    }>(
      `
      SELECT
        dv.id::text,
        dv.document_id::text,
        dv.version_number,
        dv.change_summary,
        COALESCE(dv.body, '') AS body,
        dv.created_by::text,
        dv.created_at
      FROM document_versions dv
      WHERE dv.document_id = $1::uuid
      ORDER BY dv.version_number DESC
      `,
      [documentId]
    );

    const versions: DocumentVersionDTO[] = res.rows.map((r) => ({
      id: r.id,
      documentId: r.document_id,
      versionNumber: r.version_number,
      changeSummary: r.change_summary,
      body: r.body,
      createdBy: r.created_by,
      createdAt: r.created_at.toISOString()
    }));

    return NextResponse.json({ versions });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    throw e;
  }
}

export async function POST(request: NextRequest, context: RouteCtx) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const ctx = await getUserContext(session.sub);
  if (!ctx) {
    return NextResponse.json({ message: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  const { id: documentId } = await context.params;

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
    const { workspaceId } = await assertDocumentAccess(ctx.id, documentId, "editor");
    const wsRole = await getWorkspaceRole(ctx.id, workspaceId);
    if (!wsRole || !workspaceRoleAtLeast(wsRole, "editor")) {
      throw new AccessError(403, "버전을 추가할 권한이 없습니다.");
    }

    const docRow = await db.query<{ title: string }>(
      `SELECT title FROM documents WHERE id = $1::uuid LIMIT 1`,
      [documentId]
    );
    const title = docRow.rows[0]?.title ?? "";

    const maxRes = await db.query<{ n: string }>(
      `SELECT COALESCE(MAX(version_number), 0)::text AS n FROM document_versions WHERE document_id = $1::uuid`,
      [documentId]
    );
    const nextVer = (Number.parseInt(maxRes.rows[0]?.n ?? "0", 10) || 0) + 1;

    const ins = await db.query<{ id: string }>(
      `
      INSERT INTO document_versions (
        document_id, version_number, change_summary, created_by, body
      )
      VALUES ($1::uuid, $2, $3, $4::uuid, $5)
      RETURNING id::text
      `,
      [
        documentId,
        nextVer,
        parsed.data.changeSummary?.trim() || null,
        ctx.id,
        parsed.data.body
      ]
    );

    await recordAuditAndActivity({
      userId: ctx.id,
      auditAction: "document_version_created",
      targetId: documentId,
      entityId: documentId,
      entityName: title
    });

    return NextResponse.json({ ok: true, versionId: ins.rows[0]?.id ?? null });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    throw e;
  }
}
