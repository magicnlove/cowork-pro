/**
 * 반복 일정의 각 인스턴스 시작 시각(Date) 목록을 계산한다.
 * POST는 recurrenceDays가 number[], DB/단건 조회는 "1,2,3" 형태 문자열일 수 있다.
 */

export type RecurrenceType =
  | "none"
  | "daily"
  | "weekly"
  | "weekday"
  | "monthly"
  | "yearly";

function parseRecurrenceDays(raw: number[] | string | null | undefined): number[] {
  if (raw == null || raw === "") return [];
  if (Array.isArray(raw)) {
    return raw.filter((v) => Number.isFinite(v) && v >= 1 && v <= 7);
  }
  return raw
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isFinite(v) && v >= 1 && v <= 7);
}

export function expandRecurringStarts(
  startsAt: string,
  recurrenceType: RecurrenceType,
  recurrenceEndDate?: string | null,
  recurrenceDays?: number[] | string | null,
  recurrenceDetail?: Record<string, unknown> | null
): Date[] {
  const start = new Date(startsAt);
  if (recurrenceType === "none" || recurrenceEndDate == null || recurrenceEndDate === "") {
    return [start];
  }

  const startDay = new Date(start);
  startDay.setUTCHours(0, 0, 0, 0);
  const endDay = new Date(`${recurrenceEndDate}T23:59:59.999Z`);
  if (endDay.getTime() <= start.getTime()) {
    return [start];
  }

  const startWeekday = ((start.getUTCDay() + 6) % 7) + 1;
  const selected = parseRecurrenceDays(recurrenceDays);
  const startMinutes = start.getUTCHours() * 60 + start.getUTCMinutes();

  const pushIfInRange = (out: Date[], dayAnchor: Date) => {
    const n = new Date(dayAnchor);
    n.setUTCHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
    if (n.getTime() >= start.getTime() && n.getTime() <= endDay.getTime()) {
      out.push(n);
    }
  };

  if (recurrenceType === "daily" || recurrenceType === "weekday" || recurrenceType === "weekly") {
    const out: Date[] = [];
    const d = new Date(startDay);
    for (let i = 0; i < 370 && d.getTime() <= endDay.getTime(); i++) {
      const iso = ((d.getUTCDay() + 6) % 7) + 1;
      if (recurrenceType === "daily") pushIfInRange(out, d);
      if (recurrenceType === "weekday" && iso >= 1 && iso <= 5) pushIfInRange(out, d);
      if (recurrenceType === "weekly" && selected.length > 0 && selected.includes(iso)) pushIfInRange(out, d);
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return out;
  }

  const out: Date[] = [start];
  const addAtDay = (day: Date) => pushIfInRange(out, day);

  if (recurrenceType === "monthly") {
    const mode = String(recurrenceDetail?.mode ?? "dayOfMonth");
    const dayOfMonth = Number(recurrenceDetail?.dayOfMonth ?? start.getUTCDate());
    const weekNo = Number(recurrenceDetail?.weekNo ?? Math.ceil(start.getUTCDate() / 7));
    const weekday = Number(recurrenceDetail?.weekday ?? startWeekday);
    const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1, 0, 0, 0, 0));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    for (let i = 0; i < 60 && cursor.getTime() <= endDay.getTime(); i++) {
      let candidate: Date | null = null;
      if (mode === "nthWeekday") {
        const firstIso =
          ((new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1)).getUTCDay() + 6) % 7) + 1;
        const offset = (weekday - firstIso + 7) % 7;
        const day = 1 + offset + (Math.max(1, Math.min(5, weekNo)) - 1) * 7;
        const c = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), day));
        if (c.getUTCMonth() === cursor.getUTCMonth()) candidate = c;
      } else {
        const c = new Date(
          Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), Math.max(1, Math.min(31, dayOfMonth)))
        );
        if (c.getUTCMonth() === cursor.getUTCMonth()) candidate = c;
      }
      if (candidate) addAtDay(candidate);
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return out;
  }

  if (recurrenceType === "yearly") {
    const month = Number(recurrenceDetail?.month ?? start.getUTCMonth() + 1);
    const day = Number(recurrenceDetail?.day ?? start.getUTCDate());
    for (let y = start.getUTCFullYear() + 1; y <= start.getUTCFullYear() + 10; y++) {
      const c = new Date(Date.UTC(y, Math.max(1, Math.min(12, month)) - 1, Math.max(1, Math.min(31, day))));
      if (c.getUTCMonth() !== Math.max(1, Math.min(12, month)) - 1) continue;
      if (c.getTime() > endDay.getTime()) break;
      addAtDay(c);
    }
    return out;
  }

  return [start];
}
