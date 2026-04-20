import jwt from "jsonwebtoken";
import type { NextRequest } from "next/server";
import { AUTH_TOKEN_COOKIE } from "@/lib/cookie-names";
import type { AuthTokenPayload } from "./auth";

export function getJwtSecret(): string {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is not configured.");
  }
  return jwtSecret;
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    const payload = jwt.verify(token, getJwtSecret());
    if (
      typeof payload === "object" &&
      payload !== null &&
      "sub" in payload &&
      "email" in payload
    ) {
      return {
        sub: String((payload as AuthTokenPayload).sub),
        email: String((payload as AuthTokenPayload).email)
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function getSessionFromRequest(request: NextRequest): AuthTokenPayload | null {
  const token = request.cookies.get(AUTH_TOKEN_COOKIE)?.value;
  if (!token) {
    return null;
  }
  return verifyAuthToken(token);
}
