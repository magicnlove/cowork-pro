import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_TOKEN_COOKIE, PASSWORD_CHANGE_REQUIRED_COOKIE } from "@/lib/cookie-names";

const isProd = process.env.NODE_ENV === "production";

const protectedPrefixes = [
  "/dashboard",
  "/chat",
  "/tasks",
  "/calendar",
  "/meeting-notes",
  "/activity-feed",
  "/archive",
  "/admin",
  "/account"
];

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function isForceChangeAllowed(pathname: string) {
  if (pathname === "/change-password") {
    return true;
  }
  if (pathname === "/api/auth/password") {
    return true;
  }
  if (pathname === "/api/auth/logout") {
    return true;
  }
  return false;
}

function clearStalePasswordChangeFlag(response: NextResponse) {
  response.cookies.set(PASSWORD_CHANGE_REQUIRED_COOKIE, "", {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_TOKEN_COOKIE)?.value;
  const pwdChange = request.cookies.get(PASSWORD_CHANGE_REQUIRED_COOKIE)?.value;

  if (pwdChange && !token) {
    const res = NextResponse.next();
    return clearStalePasswordChangeFlag(res);
  }

  if (pwdChange && token) {
    if (!isForceChangeAllowed(pathname)) {
      if (pathname.startsWith("/api")) {
        return NextResponse.json(
          {
            message: "임시 비밀번호 사용 중입니다. 비밀번호를 변경한 후 이용해 주세요."
          },
          { status: 403 }
        );
      }
      return NextResponse.redirect(new URL("/change-password", request.url));
    }
  }

  if (pathname.startsWith("/api") || pathname === "/") {
    return NextResponse.next();
  }

  if (pathname === "/change-password") {
    if (!token) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (pathname === "/forgot-password") {
    return NextResponse.next();
  }

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  if (!token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
