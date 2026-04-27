import type { RecurrenceType } from "@/lib/expand-recurring-starts";

/**
 * 반복 인스턴스 종료 시각은 항상 원본 템플릿 duration을 그대로 유지한다.
 * (다중일 일정은 캘린더에서 연속 bar로 렌더링되어야 함)
 */
export function computeInstanceEndsAt(
  instanceStart: Date,
  _recurrenceType: RecurrenceType,
  templateStartsAtIso: string,
  templateEndsAtIso: string,
  _recurrenceDays?: number[] | string | null
): Date {
  const tmplDurationMs =
    new Date(templateEndsAtIso).getTime() - new Date(templateStartsAtIso).getTime();
  return new Date(instanceStart.getTime() + tmplDurationMs);
}
