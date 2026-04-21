export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AccessError, assertDocumentAccess } from "@/lib/archive-scope";
import { db } from "@/lib/db";
import { emitSocketToUser } from "@/lib/user-socket-broadcast";
import { getSessionFromRequest } from "@/lib/session";
import { getUserContext } from "@/lib/user-context";
import type { DocumentCommentDTO } from "@/types/archive";

const postSchema = z.object({
  content: z.string().min(1).max(10000),
  mentionedUserIds: z.array(z.string().uuid()).optional()
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
      user_id: string;
      content: string;
      created_at: Date;
      user_name: string;
      user_email: string;
    }>(
      `
      SELECT
        c.id::text,
        c.document_id::text,
        c.user_id::text,
        c.content,
        c.created_at,
        u.name AS user_name,
        u.email AS user_email
      FROM document_comments c
      INNER JOIN users u ON u.id = c.user_id
      WHERE c.document_id = $1::uuid
      ORDER BY c.created_at ASC
      `,
      [documentId]
    );

    const comments: DocumentCommentDTO[] = res.rows.map((r) => ({
      id: r.id,
      documentId: r.document_id,
      userId: r.user_id,
      userName: r.user_name,
      userEmail: r.user_email,
      content: r.content,
      createdAt: r.created_at.toISOString()
    }));

    return NextResponse.json({ comments });
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
    const { workspaceId } = await assertDocumentAccess(ctx.id, documentId, "viewer");

    const docRow = await db.query<{ title: string }>(
      `SELECT title FROM documents WHERE id = $1::uuid LIMIT 1`,
      [documentId]
    );
    const docTitle = docRow.rows[0]?.title ?? "문서";

    const ins = await db.query<{ id: string }>(
      `
      INSERT INTO document_comments (document_id, user_id, content)
      VALUES ($1::uuid, $2::uuid, $3)
      RETURNING id::text
      `,
      [documentId, ctx.id, parsed.data.content.trim()]
    );

    const commentId = ins.rows[0]?.id;
    const mentionIds = [...new Set(parsed.data.mentionedUserIds ?? [])].filter((uid) => uid !== ctx.id);

    if (mentionIds.length > 0) {
      const mem = await db.query<{ user_id: string }>(
        `
        SELECT user_id::text
        FROM workspace_members
        WHERE workspace_id = $1::uuid
          AND user_id = ANY($2::uuid[])
        `,
        [workspaceId, mentionIds]
      );
      const allowed = new Set(mem.rows.map((r) => r.user_id));
      for (const uid of mentionIds) {
        if (!allowed.has(uid)) {
          continue;
        }
        emitSocketToUser(uid, "document:mention", {
          documentId,
          workspaceId,
          title: docTitle,
          fromName: ctx.name,
          commentId
        });
      }
    }

    return NextResponse.json({ ok: true, commentId });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    throw e;
  }
}
