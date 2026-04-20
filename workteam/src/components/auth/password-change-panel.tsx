"use client";

import { FormEvent, useState } from "react";
import {
  authDarkInputClass,
  authDarkLabelClass,
  authOrangeButtonClass
} from "@/components/auth/auth-dark-shell";

type Props = {
  variant: "forced" | "account";
  onSuccess: () => void;
};

function PolicyList({ className }: { className?: string }) {
  return (
    <ul
      className={`list-inside list-disc space-y-1.5 text-sm leading-relaxed text-white/55 ${className ?? ""}`}
    >
      <li>8자 이상</li>
      <li>영문 + 숫자 + 특수문자 조합</li>
      <li>이전 비밀번호와 달라야 함</li>
    </ul>
  );
}

export function PasswordChangePanel({ variant, onSuccess }: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (newPassword !== confirmPassword) {
      setErrorMessage("새 비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setIsLoading(true);
    try {
      const body =
        variant === "forced"
          ? { newPassword }
          : { currentPassword, newPassword };

      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body)
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setErrorMessage(data.message ?? "비밀번호를 변경하지 못했습니다.");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onSuccess();
    } catch {
      setErrorMessage("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  }

  const shell = (
    <>
      <div className="mb-8 w-full">
        <h2 className="text-lg font-semibold text-white">
          {variant === "forced" ? "비밀번호 변경" : "내 비밀번호 변경"}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-white/50">
          {variant === "forced"
            ? "보안을 위해 새 비밀번호를 설정해 주세요."
            : "현재 비밀번호를 확인한 뒤 새 비밀번호를 설정합니다."}
        </p>
      </div>

      <PolicyList className="mb-8 rounded border border-white/10 bg-white/[0.03] px-4 py-3" />

      <form className="w-full space-y-6" onSubmit={onSubmit}>
        {variant === "account" ? (
          <div>
            <label htmlFor="current-password" className={authDarkLabelClass}>
              현재 비밀번호
            </label>
            <input
              id="current-password"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              placeholder="현재 비밀번호"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={authDarkInputClass}
            />
          </div>
        ) : null}

        <div>
          <label htmlFor="new-password" className={authDarkLabelClass}>
            새 비밀번호
          </label>
          <input
            id="new-password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            placeholder="새 비밀번호"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={authDarkInputClass}
          />
        </div>
        <div>
          <label htmlFor="confirm-password" className={authDarkLabelClass}>
            새 비밀번호 확인
          </label>
          <input
            id="confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            placeholder="새 비밀번호 확인"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={authDarkInputClass}
          />
        </div>

        {errorMessage ? (
          <p className="rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {errorMessage}
          </p>
        ) : null}

        <button type="submit" disabled={isLoading} className={authOrangeButtonClass}>
          {isLoading ? "처리 중…" : variant === "forced" ? "비밀번호 변경" : "변경 저장"}
        </button>
      </form>
    </>
  );

  if (variant === "account") {
    return (
      <div className="w-full max-w-[400px] rounded-xl border border-white/10 bg-[#0D1117] p-8 shadow-xl">{shell}</div>
    );
  }

  return <div className="w-full max-w-[400px]">{shell}</div>;
}
