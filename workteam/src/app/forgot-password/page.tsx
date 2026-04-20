"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import {
  AuthDarkShell,
  AuthLogoHeader,
  authDarkInputClass,
  authDarkLabelClass,
  authOrangeButtonClass
} from "@/components/auth/auth-dark-shell";

export default function ForgotPasswordPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/password-reset-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() })
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setErrorMessage(data.message ?? "요청을 처리하지 못했습니다.");
        return;
      }

      setDone(true);
      setName("");
      setEmail("");
    } catch {
      setErrorMessage("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthDarkShell>
      <div className="flex w-full max-w-[400px] flex-col items-stretch">
        <AuthLogoHeader />

        <div className="mb-8 w-full text-center">
          <h2 className="text-lg font-semibold text-white">비밀번호 재설정 요청</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/50">
            가입 시 등록된 이름과 이메일을 입력해 주세요. 관리자 승인 후 임시 비밀번호가 발급됩니다.
          </p>
        </div>

        {done ? (
          <div className="space-y-8">
            <p className="rounded border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center text-sm leading-relaxed text-emerald-100">
              관리자에게 요청이 전달되었습니다
            </p>
            <Link
              href="/"
              className="block text-center text-sm text-white/45 transition hover:text-white/90"
            >
              로그인으로 돌아가기
            </Link>
          </div>
        ) : (
          <form className="w-full space-y-6" onSubmit={onSubmit}>
            <div>
              <label htmlFor="name" className={authDarkLabelClass}>
                이름
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                placeholder="이름을 입력하세요"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={authDarkInputClass}
              />
            </div>
            <div>
              <label htmlFor="email" className={authDarkLabelClass}>
                이메일
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={authDarkInputClass}
              />
            </div>

            {errorMessage ? (
              <p className="rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {errorMessage}
              </p>
            ) : null}

            <button type="submit" disabled={isLoading} className={authOrangeButtonClass}>
              {isLoading ? "처리 중…" : "재설정 요청"}
            </button>

            <Link
              href="/"
              className="mt-2 block text-center text-sm text-white/45 transition hover:text-white/90"
            >
              로그인으로 돌아가기
            </Link>
          </form>
        )}

        <p className="mt-10 text-center text-[13px] leading-relaxed text-white/45">
          내부망 전용 서비스 · 계정은 관리자가 생성합니다
        </p>
      </div>
    </AuthDarkShell>
  );
}
