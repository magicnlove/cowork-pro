export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { mergeNavVisibility } from "@/lib/navigation-settings";
import { db } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/session";

export async function GET(_request: NextRequest) {
  const session = getSessionFromRequest(_request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const res = await db.query<{ value: unknown }>(
    `
    SELECT value
    FROM app_settings
    WHERE key = 'navigation_menus'
    LIMIT 1
    `
  );
  const visibility = mergeNavVisibility(res.rows[0]?.value);
  return NextResponse.json({ visibility });
}
