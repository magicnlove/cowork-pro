import * as XLSX from "xlsx";

export type ParsedImportRow = {
  rowIndex: number;
  email: string;
  password: string;
  name: string;
  role: string;
  departments: string;
};

function norm(s: unknown): string {
  return String(s ?? "")
    .trim()
    .toLowerCase();
}

function findColIndex(headers: unknown[], candidates: string[]): number {
  const h = headers.map(norm);
  for (const c of candidates) {
    const i = h.indexOf(c.toLowerCase());
    if (i >= 0) {
      return i;
    }
  }
  return -1;
}

/** 첫 시트, 1행 헤더 기준. 열: 이메일, 임시비밀번호, 이름, 역할, 부서 */
export function parseUserImportWorkbook(buffer: ArrayBuffer): ParsedImportRow[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return [];
  }
  const sheet = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number | undefined)[]>(sheet, {
    header: 1,
    raw: false,
    defval: ""
  }) as string[][];

  if (matrix.length < 2) {
    return [];
  }

  const headerRow = matrix[0] ?? [];
  const ci = findColIndex(headerRow, ["이메일", "email"]);
  const cp = findColIndex(headerRow, ["임시비밀번호", "비밀번호", "password"]);
  const cn = findColIndex(headerRow, ["이름", "name"]);
  const cr = findColIndex(headerRow, ["역할", "role"]);
  const cd = findColIndex(headerRow, ["부서", "department", "departments"]);

  if (ci < 0 || cp < 0 || cn < 0 || cr < 0) {
    throw new Error("필수 열(이메일, 임시비밀번호, 이름, 역할)을 찾을 수 없습니다. 템플릿을 확인해 주세요.");
  }

  const out: ParsedImportRow[] = [];
  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i] ?? [];
    const email = String(row[ci] ?? "").trim();
    const password = String(row[cp] ?? "").trim();
    const name = String(row[cn] ?? "").trim();
    const role = String(row[cr] ?? "").trim();
    const departments = cd >= 0 ? String(row[cd] ?? "").trim() : "";
    if (!email && !password && !name && !role && !departments) {
      continue;
    }
    out.push({
      rowIndex: i + 1,
      email,
      password,
      name,
      role,
      departments
    });
  }
  return out;
}
