import jwt from "jsonwebtoken";

export const TOKEN_EXPIRES_IN_SECONDS = 60 * 60 * 8;

export { PASSWORD_CHANGE_REQUIRED_COOKIE } from "@/lib/cookie-names";

export type AuthTokenPayload = {
  sub: string;
  email: string;
};

function getJwtSecret() {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is not configured.");
  }
  return jwtSecret;
}

export function signAuthToken(payload: AuthTokenPayload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: TOKEN_EXPIRES_IN_SECONDS });
}

export const authCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: TOKEN_EXPIRES_IN_SECONDS
};

export const passwordChangeRequiredCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: TOKEN_EXPIRES_IN_SECONDS
};
