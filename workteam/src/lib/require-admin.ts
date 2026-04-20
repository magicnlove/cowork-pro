import { NextResponse } from "next/server";
import type { UserContext } from "@/lib/user-context";

export function denyUnlessAdmin(ctx: UserContext | null) {
  if (!ctx) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  if (ctx.role !== "admin") {
    return NextResponse.json({ message: "관리자만 접근할 수 있습니다." }, { status: 403 });
  }
  return null;
}
