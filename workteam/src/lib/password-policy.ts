/** 비밀번호 정책: 8자 이상, 영문 + 숫자 + 특수문자 */
const SPECIAL_RE = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

export function validatePasswordPolicy(password: string): string | null {
  if (password.length < 8) {
    return "비밀번호는 8자 이상이어야 합니다.";
  }
  if (!/[A-Za-z]/.test(password)) {
    return "비밀번호에 영문을 포함해야 합니다.";
  }
  if (!/[0-9]/.test(password)) {
    return "비밀번호에 숫자를 포함해야 합니다.";
  }
  if (!SPECIAL_RE.test(password)) {
    return "비밀번호에 특수문자를 포함해야 합니다.";
  }
  return null;
}

/** 임시 비밀번호 자동 생성 (정책 충족) */
export function generateSecureTempPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const nums = "23456789";
  const special = "!@#$%&*";
  const pool = upper + lower + nums + special;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)]!;
  let out = pick(upper) + pick(lower) + pick(nums) + pick(special);
  for (let i = 0; i < 8; i++) {
    out += pick(pool);
  }
  const arr = out.split("");
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  const candidate = arr.join("");
  if (validatePasswordPolicy(candidate) !== null) {
    return generateSecureTempPassword();
  }
  return candidate;
}
