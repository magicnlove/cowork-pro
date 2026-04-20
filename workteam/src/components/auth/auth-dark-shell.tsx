"use client";

import Image from "next/image";
import type { ReactNode } from "react";

const ORANGE = "#E8692A";

/** 전체 화면 다크 배경 + 오렌지 원형 그라데이션 장식 */
export function AuthDarkShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0D1117]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 85% 65% at 18% 22%, rgba(232, 105, 42, 0.12), transparent 52%),
            radial-gradient(ellipse 75% 55% at 88% 78%, rgba(232, 105, 42, 0.12), transparent 50%),
            radial-gradient(ellipse 50% 40% at 55% 55%, rgba(232, 105, 42, 0.08), transparent 45%)
          `
        }}
        aria-hidden
      />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-12 text-white">
        {children}
      </div>
    </div>
  );
}

export function AuthLogoHeader() {
  return (
    <div className="mb-10 flex w-full max-w-[400px] flex-col items-center text-center">
      <Image
        src="/logo.png"
        alt="한화투자증권 로고"
        width={64}
        height={64}
        className="h-16 w-16 object-contain"
        priority
      />
      <h1 className="mt-5 text-[22px] font-medium leading-tight text-white">한화투자증권</h1>
      <p className="mt-1.5 text-[13px] text-white/50">내부망 업무 협업툴</p>
    </div>
  );
}

export const authDarkInputClass =
  "w-full border-0 border-b border-white/25 bg-transparent py-3 text-base text-white outline-none ring-0 transition placeholder:text-white/30 focus:border-[#E8692A]";

export const authDarkLabelClass =
  "mb-1 block text-[11px] font-medium uppercase tracking-wider text-[#E8692A]";

export const authOrangeButtonClass =
  "flex h-[52px] w-full items-center justify-center rounded-[4px] bg-[#E8692A] text-base font-semibold text-white transition hover:bg-[#C45A1A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8692A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D1117] disabled:opacity-50";
