import { NextResponse } from "next/server";
import { authCookieOptions, passwordChangeRequiredCookieOptions } from "@/lib/auth";
import { AUTH_TOKEN_COOKIE, PASSWORD_CHANGE_REQUIRED_COOKIE } from "@/lib/cookie-names";

/**
 * auth_token 및 비밀번호 강제 변경 플래그 쿠키 삭제. 인증 여부와 관계없이 호출 가능.
 */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_TOKEN_COOKIE, "", {
    ...authCookieOptions,
    maxAge: 0
  });
  res.cookies.set(PASSWORD_CHANGE_REQUIRED_COOKIE, "", {
    ...passwordChangeRequiredCookieOptions,
    maxAge: 0
  });
  return res;
}
