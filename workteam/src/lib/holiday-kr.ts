type HolidayMap = Map<string, string>;

const FIXED_HOLIDAYS: Array<{ md: string; name: string }> = [
  { md: "01-01", name: "\uC2E0\uC815" },
  { md: "03-01", name: "\uC0BC\uC77C\uC808" },
  { md: "05-05", name: "\uC5B4\uB9B0\uC774\uB0A0" },
  { md: "06-06", name: "\uD604\uCDA9\uC77C" },
  { md: "08-15", name: "\uAD11\uBCF5\uC808" },
  { md: "10-03", name: "\uAC1C\uCC9C\uC808" },
  { md: "10-09", name: "\uD55C\uAE00\uB0A0" },
  { md: "12-25", name: "\uC131\uD0C4\uC808" }
];

const CHINESE_FMT =
  typeof Intl !== "undefined"
    ? new Intl.DateTimeFormat("en-US-u-ca-chinese", {
        timeZone: "Asia/Seoul",
        month: "numeric",
        day: "numeric"
      })
    : null;

function pad2(v: number): string {
  return String(v).padStart(2, "0");
}

function parseChineseMonthDay(d: Date): { month: number; day: number } | null {
  if (!CHINESE_FMT) return null;
  const parts = CHINESE_FMT.formatToParts(d);
  const m = Number(parts.find((p) => p.type === "month")?.value ?? "");
  const day = Number(parts.find((p) => p.type === "day")?.value ?? "");
  if (!Number.isFinite(m) || !Number.isFinite(day)) return null;
  return { month: m, day };
}

function findLunarDayInYear(gregorianYear: number, lunarMonth: number, lunarDay: number): string | null {
  // Lunar holiday dates usually fall around Jan-Feb or Sep-Oct, so we scan the year.
  const start = new Date(Date.UTC(gregorianYear, 0, 1, 0, 0, 0));
  for (let i = 0; i < 370; i++) {
    const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    if (d.getUTCFullYear() !== gregorianYear && i > 31) break;
    const md = parseChineseMonthDay(d);
    if (!md) continue;
    if (md.month === lunarMonth && md.day === lunarDay) {
      return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
    }
  }
  return null;
}

function setHoliday(out: HolidayMap, isoDate: string, name: string) {
  if (!out.has(isoDate)) {
    out.set(isoDate, name);
  }
}

export function buildKoreanHolidayMap(startYear = 2024, endYear = 2040): HolidayMap {
  const out: HolidayMap = new Map();
  for (let y = startYear; y <= endYear; y++) {
    for (const h of FIXED_HOLIDAYS) {
      setHoliday(out, `${y}-${h.md}`, h.name);
    }
    // Major lunar holidays (single day only): Seollal (1/1), Chuseok (8/15).
    const seollal = findLunarDayInYear(y, 1, 1);
    const chuseok = findLunarDayInYear(y, 8, 15);
    if (seollal) setHoliday(out, seollal, "\uC124\uB0A0");
    if (chuseok) setHoliday(out, chuseok, "\uCD94\uC11D");
  }
  return out;
}

