import { NextRequest, NextResponse } from "next/server";
import { getRecentModifiedDocuments, getWorkspaceCardSummaries } from "@/lib/archive-queries";
import { getSessionFromRequest } from "@/lib/session";
import { getUserContext } from "@/lib/user-context";

export async function GET(_request: NextRequest) {
  const session = getSessionFromRequest(_request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const ctx = await getUserContext(session.sub);
  if (!ctx) {
    return NextResponse.json({ message: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  const [workspaces, recentModifiedDocuments] = await Promise.all([
    getWorkspaceCardSummaries(ctx.id),
    getRecentModifiedDocuments(ctx.id, 5)
  ]);

  return NextResponse.json(
    { workspaces, recentModifiedDocuments },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate"
      }
    }
  );
}
