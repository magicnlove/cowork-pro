export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { CHANNEL_ACCESS_PREDICATE } from "@/lib/channel-access";
import { getVisibleDepartmentIds } from "@/lib/org-scope";
import { getSessionFromRequest } from "@/lib/session";
import { getUserContext } from "@/lib/user-context";
import type { GlobalSearchItemDTO, GlobalSearchType } from "@/types/search";

const querySchema = z.object({
  q: z.string().trim().min(1).max(200),
  type: z.enum(["all", "chat", "task", "note", "event", "file"]).optional().default("all")
});

function patternFromQuery(q: string) {
  return `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
}

function truncateSnippet(s: string, max = 140) {
  const t = s.replace(/\u200b/g, "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function logSearchError(category: GlobalSearchType | "scope" | "user-context", error: unknown, meta?: object) {
  console.error(`[GET /api/search] ${category} failed`, {
    ...(meta ?? {}),
    error: error instanceof Error ? { message: error.message, stack: error.stack } : error
  });
}

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const parsed = querySchema.safeParse({
    q: request.nextUrl.searchParams.get("q") ?? "",
    type: (request.nextUrl.searchParams.get("type") ?? undefined) as GlobalSearchType | undefined
  });
  if (!parsed.success) {
    return NextResponse.json({ message: "검색어(q)가 필요합니다." }, { status: 400 });
  }

  let ctx: Awaited<ReturnType<typeof getUserContext>>;
  try {
    ctx = await getUserContext(session.sub);
  } catch (error) {
    logSearchError("user-context", error, { userId: session.sub });
    return NextResponse.json({ message: "사용자 정보를 불러오지 못했습니다." }, { status: 500 });
  }
  if (!ctx) {
    return NextResponse.json({ message: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }
  const userCtx = ctx as NonNullable<typeof ctx>;

  const q = parsed.data.q;
  const type = parsed.data.type;
  const pat = patternFromQuery(q);
  let scope: string[] = [];
  try {
    scope = userCtx.role === "admin" ? [] : await getVisibleDepartmentIds(userCtx);
    console.info("[GET /api/search] scope resolved", {
      userId: userCtx.id,
      role: userCtx.role,
      departmentCount: userCtx.departments.length,
      scopeCount: scope.length,
      type,
      q
    });
  } catch (error) {
    logSearchError("scope", error, {
      userId: userCtx.id,
      role: userCtx.role,
      type,
      q
    });
    scope = userCtx.role === "admin" ? [] : userCtx.departments.map((d) => d.id);
  }

  const items: GlobalSearchItemDTO[] = [];

  async function searchChat() {
    const res = await db.query<{
      category: "chat";
      id: string;
      channel_id: string;
      title: string;
      snippet: string | null;
      department_id: string | null;
      department_name: string | null;
      occurred_at: Date;
    }>(
      `
      SELECT
        'chat'::text AS category,
        m.id::text AS id,
        m.channel_id::text AS channel_id,
        c.name AS title,
        m.body AS snippet,
        c.department_id::text AS department_id,
        d.name AS department_name,
        m.created_at AS occurred_at
      FROM messages m
      INNER JOIN channels c ON c.id = m.channel_id
      LEFT JOIN departments d ON d.id = c.department_id
      INNER JOIN users u ON u.id = $1::uuid
      WHERE ${CHANNEL_ACCESS_PREDICATE}
        AND m.deleted_at IS NULL
        AND m.parent_message_id IS NULL
        AND (
          c.name ILIKE $2 ESCAPE '\\'
          OR m.body ILIKE $2 ESCAPE '\\'
        )
      ORDER BY m.created_at DESC
      LIMIT 20
      `,
      [userCtx.id, pat]
    );
    for (const r of res.rows) {
      items.push({
        category: "chat",
        id: r.id,
        title: r.title,
        snippet: r.snippet ? truncateSnippet(r.snippet) : null,
        departmentId: r.department_id,
        departmentName: r.department_name,
        occurredAt: r.occurred_at.toISOString(),
        link: `/chat?channelId=${encodeURIComponent(r.channel_id)}&focusMessageId=${encodeURIComponent(r.id)}`
      });
    }
  }

  async function searchTasks() {
    const res = await db.query<{
      id: string;
      title: string;
      description: string | null;
      department_id: string | null;
      department_name: string | null;
      updated_at: Date;
    }>(
      `
      SELECT
        t.id::text,
        t.title,
        t.description,
        t.department_id::text,
        d.name AS department_name,
        t.updated_at
      FROM tasks t
      LEFT JOIN departments d ON d.id = t.department_id
      WHERE (
        t.title ILIKE $1 ESCAPE '\\'
        OR COALESCE(t.description, '') ILIKE $1 ESCAPE '\\'
      )
      AND (
        $2::text = 'admin'
        OR (
          (t.department_id IS NOT NULL AND t.department_id = ANY($3::uuid[]))
          OR (t.department_id IS NULL AND t.created_by = $4::uuid)
        )
      )
      ORDER BY t.updated_at DESC
      LIMIT 20
      `,
      [pat, userCtx.role, scope, userCtx.id]
    );
    for (const r of res.rows) {
      items.push({
        category: "task",
        id: r.id,
        title: r.title,
        snippet: r.description ? truncateSnippet(r.description) : null,
        departmentId: r.department_id,
        departmentName: r.department_name,
        occurredAt: r.updated_at.toISOString(),
        link: "/tasks"
      });
    }
  }

  async function searchNotes() {
    const res = await db.query<{
      id: string;
      title: string;
      body: string | null;
      department_id: string;
      department_name: string;
      updated_at: Date;
    }>(
      `
      WITH note_text AS (
        SELECT
          n.id,
          n.title,
          n.department_id,
          n.updated_at,
          (
            SELECT STRING_AGG(COALESCE(nb.body, ''), ' ' ORDER BY nb.sort_order ASC)
            FROM note_blocks nb
            WHERE nb.note_id = n.id
          ) AS body
        FROM meeting_notes n
      )
      SELECT
        nt.id::text,
        nt.title,
        nt.body,
        nt.department_id::text,
        d.name AS department_name,
        nt.updated_at
      FROM note_text nt
      INNER JOIN departments d ON d.id = nt.department_id
      WHERE (
        nt.title ILIKE $1 ESCAPE '\\'
        OR COALESCE(nt.body, '') ILIKE $1 ESCAPE '\\'
      )
      AND ($2::text = 'admin' OR nt.department_id = ANY($3::uuid[]))
      ORDER BY nt.updated_at DESC
      LIMIT 20
      `,
      [pat, userCtx.role, scope]
    );
    for (const r of res.rows) {
      items.push({
        category: "note",
        id: r.id,
        title: r.title,
        snippet: r.body ? truncateSnippet(r.body) : null,
        departmentId: r.department_id,
        departmentName: r.department_name,
        occurredAt: r.updated_at.toISOString(),
        link: `/meeting-notes?id=${encodeURIComponent(r.id)}`
      });
    }
  }

  async function searchEvents() {
    const res = await db.query<{
      id: string;
      title: string;
      description: string | null;
      department_id: string | null;
      department_name: string | null;
      starts_at: Date;
      kind: string;
      created_by: string | null;
      attendee_user_ids: string[] | null;
    }>(
      `
      SELECT
        e.id::text,
        e.title,
        e.description,
        e.department_id::text,
        d.name AS department_name,
        e.starts_at,
        e.kind,
        e.created_by,
        e.attendee_user_ids
      FROM events e
      LEFT JOIN departments d ON d.id = e.department_id
      WHERE (
        e.title ILIKE $1 ESCAPE '\\'
        OR COALESCE(e.description, '') ILIKE $1 ESCAPE '\\'
      )
      AND (
        $2::text = 'admin'
        OR (
          e.kind = 'announcement'
          OR (e.kind = 'personal' AND (e.created_by = $3::uuid OR $3::uuid = ANY(e.attendee_user_ids)))
          OR (e.kind = 'team' AND e.department_id IS NOT NULL AND e.department_id = ANY($4::uuid[]))
        )
      )
      ORDER BY e.starts_at DESC
      LIMIT 20
      `,
      [pat, userCtx.role, userCtx.id, scope]
    );
    for (const r of res.rows) {
      items.push({
        category: "event",
        id: r.id,
        title: r.title,
        snippet: r.description ? truncateSnippet(r.description) : null,
        departmentId: r.department_id,
        departmentName: r.department_name,
        occurredAt: r.starts_at.toISOString(),
        link: "/calendar"
      });
    }
  }

  async function searchFiles() {
    const res = await db.query<{
      id: string;
      original_name: string;
      entity_type: string;
      entity_id: string;
      department_id: string | null;
      department_name: string | null;
      created_at: Date;
    }>(
      `
      SELECT
        fa.id::text,
        fa.original_name,
        fa.entity_type,
        fa.entity_id::text,
        dept.department_id::text AS department_id,
        d.name AS department_name,
        fa.created_at
      FROM file_attachments fa
      LEFT JOIN LATERAL (
        SELECT t.department_id
        FROM tasks t
        WHERE fa.entity_type = 'task' AND t.id = fa.entity_id
        UNION ALL
        SELECT n.department_id
        FROM meeting_notes n
        WHERE fa.entity_type = 'meeting_note' AND n.id = fa.entity_id
        UNION ALL
        SELECT c.department_id
        FROM messages m
        INNER JOIN channels c ON c.id = m.channel_id
        INNER JOIN users u ON u.id = $1::uuid
        WHERE fa.entity_type = 'chat_message'
          AND m.id = fa.entity_id
          AND ${CHANNEL_ACCESS_PREDICATE}
        LIMIT 1
      ) dept ON TRUE
      LEFT JOIN departments d ON d.id = dept.department_id
      WHERE fa.original_name ILIKE $2 ESCAPE '\\'
        AND (
          $3::text = 'admin'
          OR dept.department_id = ANY($4::uuid[])
          OR (dept.department_id IS NULL AND fa.uploaded_by = $1::uuid)
        )
      ORDER BY fa.created_at DESC
      LIMIT 20
      `,
      [userCtx.id, pat, userCtx.role, scope]
    );
    for (const r of res.rows) {
      const link =
        r.entity_type === "task"
          ? "/tasks"
          : r.entity_type === "meeting_note"
            ? `/meeting-notes?id=${encodeURIComponent(r.entity_id)}`
            : "/chat";
      items.push({
        category: "file",
        id: r.id,
        title: r.original_name,
        snippet: null,
        departmentId: r.department_id,
        departmentName: r.department_name,
        occurredAt: r.created_at.toISOString(),
        link
      });
    }
  }

  async function runCategory(category: Exclude<GlobalSearchType, "all">, fn: () => Promise<void>) {
    try {
      await fn();
    } catch (error) {
      logSearchError(category, error, {
        userId: userCtx.id,
        role: userCtx.role,
        scopeCount: scope.length,
        q
      });
    }
  }

  if (type === "all" || type === "chat") await runCategory("chat", searchChat);
  if (type === "all" || type === "task") await runCategory("task", searchTasks);
  if (type === "all" || type === "note") await runCategory("note", searchNotes);
  if (type === "all" || type === "event") await runCategory("event", searchEvents);
  if (type === "all" || type === "file") await runCategory("file", searchFiles);

  items.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  return NextResponse.json({ items: items.slice(0, 80) });
}

