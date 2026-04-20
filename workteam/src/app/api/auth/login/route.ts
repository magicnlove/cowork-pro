import bcrypt from "bcrypt";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  authCookieOptions,
  passwordChangeRequiredCookieOptions,
  signAuthToken
} from "@/lib/auth";
import { AUTH_TOKEN_COOKIE, PASSWORD_CHANGE_REQUIRED_COOKIE } from "@/lib/cookie-names";
import { db } from "@/lib/db";

const loginSchema = z.object({
  email: z.string().email("유효한 이메일 주소를 입력해주세요."),
  password: z.string().min(1, "비밀번호를 입력해주세요.")
});

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  is_temp_password: boolean;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? "요청 형식이 올바르지 않습니다." },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;
    const result = await db.query<UserRow>(
      "SELECT id, email, password_hash, is_temp_password FROM users WHERE email = $1 LIMIT 1",
      [email.toLowerCase()]
    );
    const user = result.rows[0];

    if (!user) {
      return NextResponse.json(
        { message: "이메일 또는 비밀번호가 올바르지 않습니다." },
        { status: 401 }
      );
    }

    const isMatched = await bcrypt.compare(password, user.password_hash);
    if (!isMatched) {
      return NextResponse.json(
        { message: "이메일 또는 비밀번호가 올바르지 않습니다." },
        { status: 401 }
      );
    }

    const token = signAuthToken({ sub: user.id, email: user.email });
    const response = NextResponse.json({
      token,
      requiresPasswordChange: user.is_temp_password
    });
    response.cookies.set(AUTH_TOKEN_COOKIE, token, authCookieOptions);
    if (user.is_temp_password) {
      response.cookies.set(PASSWORD_CHANGE_REQUIRED_COOKIE, "1", passwordChangeRequiredCookieOptions);
    } else {
      response.cookies.set(PASSWORD_CHANGE_REQUIRED_COOKIE, "", {
        ...passwordChangeRequiredCookieOptions,
        maxAge: 0
      });
    }
    return response;
  } catch (error) {
    console.error("Login API error:", error);
    return NextResponse.json(
      { message: "로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 }
    );
  }
}
