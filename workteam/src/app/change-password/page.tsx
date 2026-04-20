"use client";

import { useRouter } from "next/navigation";
import { AuthDarkShell, AuthLogoHeader } from "@/components/auth/auth-dark-shell";
import { PasswordChangePanel } from "@/components/auth/password-change-panel";

export default function ChangePasswordPage() {
  const router = useRouter();

  return (
    <AuthDarkShell>
      <div className="flex w-full max-w-[400px] flex-col items-stretch">
        <AuthLogoHeader />
        <PasswordChangePanel variant="forced" onSuccess={() => router.replace("/dashboard")} />
        <p className="mt-10 text-center text-[13px] leading-relaxed text-white/45">
          내부망 전용 서비스 · 계정은 관리자가 생성합니다
        </p>
      </div>
    </AuthDarkShell>
  );
}
