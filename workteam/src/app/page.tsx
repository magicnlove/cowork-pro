"use client";

import Link from "next/link";
import { type CSSProperties, type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const outerStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#F0EEE8",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "40px 20px",
  backgroundImage:
    "repeating-linear-gradient(45deg, rgba(0,0,0,0.03) 0px, rgba(0,0,0,0.03) 1px, transparent 1px, transparent 8px)"
};

const cardStyle: CSSProperties = {
  background: "#fff",
  borderRadius: "20px",
  padding: "48px 44px",
  width: "100%",
  maxWidth: "420px",
  border: "0.5px solid rgba(0,0,0,0.08)"
};

const labelStyle: CSSProperties = {
  fontSize: "13px",
  fontWeight: 500,
  color: "#1A1A1A",
  marginBottom: "6px",
  display: "block"
};

function inputStyle(focused: boolean): CSSProperties {
  return {
    width: "100%",
    height: "44px",
    border: focused ? "1.5px solid #E8692A" : "1.5px solid #E8E6E0",
    borderRadius: "8px",
    padding: "0 14px",
    fontSize: "14px",
    color: "#1A1A1A",
    background: "#fff",
    outline: "none",
    boxShadow: focused ? "0 0 0 3px rgba(232,105,42,0.1)" : "none",
    boxSizing: "border-box" as const
  };
}

export default function HomePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [buttonHovered, setButtonHovered] = useState(false);
  const [forgotHovered, setForgotHovered] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });
      const data = (await response.json()) as { message?: string; requiresPasswordChange?: boolean };

      if (!response.ok) {
        setErrorMessage(data.message ?? "로그인에 실패했습니다.");
        return;
      }

      if (data.requiresPasswordChange) {
        router.push("/change-password");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setErrorMessage("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <style>{`
        [data-login-placeholder]::placeholder { color: #999; opacity: 1; }
        [data-login-placeholder]::-webkit-input-placeholder { color: #999; }
      `}</style>

      <div style={outerStyle}>
        <div style={cardStyle}>
          <div
            style={{
              width: "52px",
              height: "52px",
              background: "#FFF3EE",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 14px"
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="한화투자증권 로고"
              style={{ width: "36px", height: "36px", objectFit: "contain" }}
            />
          </div>
          <h1
            style={{
              fontSize: "22px",
              fontWeight: 500,
              color: "#1A1A1A",
              textAlign: "center",
              marginBottom: "6px",
              marginTop: 0
            }}
          >
            한화투자증권
          </h1>
          <p style={{ fontSize: "14px", color: "#999", textAlign: "center", marginBottom: "28px", marginTop: 0 }}>
            내부망 업무 협업툴에 로그인
          </p>

          <form onSubmit={onSubmit}>
            <div style={{ marginBottom: "16px" }}>
              <label htmlFor="email" style={labelStyle}>
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
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                data-login-placeholder
                style={inputStyle(emailFocused)}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label htmlFor="password" style={labelStyle}>
                비밀번호
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="비밀번호를 입력하세요"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                data-login-placeholder
                style={inputStyle(passwordFocused)}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
                marginTop: "4px"
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  cursor: "pointer",
                  fontSize: "13px",
                  color: "#666",
                  userSelect: "none"
                }}
              >
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ width: "16px", height: "16px", accentColor: "#E8692A", cursor: "pointer" }}
                />
                로그인 상태 유지
              </label>
              <Link
                href="/forgot-password"
                onMouseEnter={() => setForgotHovered(true)}
                onMouseLeave={() => setForgotHovered(false)}
                style={{
                  fontSize: "13px",
                  color: forgotHovered ? "#C45A1A" : "#E8692A",
                  fontWeight: 500,
                  textDecoration: "none"
                }}
              >
                비밀번호를 잊으셨나요?
              </Link>
            </div>

            {errorMessage ? (
              <div
                style={{
                  marginBottom: "16px",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid rgba(220,38,38,0.35)",
                  background: "rgba(254,226,226,0.5)",
                  color: "#991B1B",
                  fontSize: "14px"
                }}
              >
                {errorMessage}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isLoading}
              onMouseEnter={() => setButtonHovered(true)}
              onMouseLeave={() => setButtonHovered(false)}
              style={{
                width: "100%",
                height: "46px",
                background:
                  isLoading ? "#E8692A" : buttonHovered ? "#C45A1A" : "#E8692A",
                border: "none",
                borderRadius: "8px",
                color: "#fff",
                fontSize: "15px",
                fontWeight: 500,
                cursor: isLoading ? "not-allowed" : "pointer",
                opacity: isLoading ? 0.75 : 1
              }}
            >
              {isLoading ? "로그인 중…" : "로그인"}
            </button>
          </form>

          <p style={{ textAlign: "center", marginTop: "24px", fontSize: "12px", color: "#CCC", marginBottom: 0 }}>
            내부망 전용 서비스 · 계정은 관리자가 생성합니다
          </p>
        </div>
      </div>
    </>
  );
}
