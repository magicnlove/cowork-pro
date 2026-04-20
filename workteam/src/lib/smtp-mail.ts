import nodemailer from "nodemailer";

export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.SMTP_FROM
  );
}

export type TempPasswordEmailVariant = "reset_request" | "admin_issue";

export async function sendTempPasswordEmail(
  to: string,
  displayName: string,
  tempPassword: string,
  variant: TempPasswordEmailVariant = "reset_request"
) {
  if (!isSmtpConfigured()) {
    return { sent: false as const };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  const introLine =
    variant === "admin_issue"
      ? "한화투자증권 내부망 업무 협업툴 관리자가 임시 비밀번호를 발급했습니다."
      : "한화투자증권 내부망 업무 협업툴 관리자가 비밀번호 재설정을 승인했습니다.";

  const subject = "[한화투자증권] 내부망 협업툴 임시 비밀번호 안내";
  const text = [
    `${displayName}님, 안녕하세요.`,
    "",
    introLine,
    "아래 임시 비밀번호로 로그인한 뒤, 반드시 비밀번호를 변경해 주세요.",
    "",
    `임시 비밀번호: ${tempPassword}`,
    "",
    "본 메일은 발신 전용입니다."
  ].join("\n");

  const html = `
    <p>${escapeHtml(displayName)}님, 안녕하세요.</p>
    <p>${escapeHtml(introLine)}</p>
    <p>아래 임시 비밀번호로 로그인한 뒤, <strong>반드시 비밀번호를 변경</strong>해 주세요.</p>
    <p style="font-size:16px;font-weight:bold;color:#E8692A;">임시 비밀번호: ${escapeHtml(tempPassword)}</p>
    <p style="color:#64748b;font-size:12px;">본 메일은 발신 전용입니다.</p>
  `;

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    text,
    html
  });
  return { sent: true as const };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
