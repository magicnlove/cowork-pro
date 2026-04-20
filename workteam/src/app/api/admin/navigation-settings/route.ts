import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  NAV_MENU_KEYS,
  mergeNavVisibility,
  type NavMenuKey,
  type NavMenuVisibility
} from "@/lib/navigation-settings";
import { db } from "@/lib/db";
import { denyUnlessAdmin } from "@/lib/require-admin";
import { getSessionFromRequest } from "@/lib/session";
import { getUserContext } from "@/lib/user-context";

const patchSchema = z
  .object({
    dashboard: z.boolean().optional(),
    chat: z.boolean().optional(),
    tasks: z.boolean().optional(),
    calendar: z.boolean().optional(),
    meeting_notes: z.boolean().optional(),
    activity_feed: z.boolean().optional(),
    archive: z.boolean().optional()
  })
  .strict();

export async function PATCH(request: NextRequest) {
  const session = getSessionFromRequest(request);
  const ctx = session ? await getUserContext(session.sub) : null;
  const denied = denyUnlessAdmin(ctx);
  if (denied) {
    return denied;
  }

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

  const patch = parsed.data;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ message: "변경할 항목이 없습니다." }, { status: 400 });
  }

  const cur = await db.query<{ value: unknown }>(
    `
    SELECT value
    FROM app_settings
    WHERE key = 'navigation_menus'
    LIMIT 1
    `
  );
  const merged = mergeNavVisibility(cur.rows[0]?.value);
  const next: NavMenuVisibility = { ...merged };

  for (const k of NAV_MENU_KEYS) {
    const v = (patch as Partial<Record<NavMenuKey, boolean>>)[k];
    if (typeof v === "boolean") {
      next[k] = v;
    }
  }

  await db.query(
    `
    INSERT INTO app_settings (key, value, updated_at)
    VALUES ('navigation_menus', $1::jsonb, NOW())
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_at = EXCLUDED.updated_at
    `,
    [JSON.stringify(next)]
  );

  return NextResponse.json({ visibility: next });
}
