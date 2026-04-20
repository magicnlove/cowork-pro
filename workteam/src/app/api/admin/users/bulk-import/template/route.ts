import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { denyUnlessAdmin } from "@/lib/require-admin";
import { getSessionFromRequest } from "@/lib/session";
import { getUserContext } from "@/lib/user-context";

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }
  const ctx = await getUserContext(session.sub);
  const denied = denyUnlessAdmin(ctx);
  if (denied) {
    return denied;
  }

  const ws = XLSX.utils.aoa_to_sheet([
    ["이메일", "임시비밀번호", "이름", "역할", "부서"],
    ["user@example.com", "TempPass1!", "홍길동", "member", "부서명(복수 시 콤마로 구분)"]
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "사용자");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="user-import-template.xlsx"'
    }
  });
}
