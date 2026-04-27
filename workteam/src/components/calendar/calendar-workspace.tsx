"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { markNavBadgeRead } from "@/lib/nav-badge-read";
import { KOREAN_HOLIDAY_MAP_2024_2040 } from "@/lib/holiday-kr";
import type { UserOption } from "@/types/tasks";
import {
  KIND_LABEL,
  type CalendarEvent,
  type CalendarKind,
  type CalendarViewMode
} from "@/types/calendar";

dayjs.extend(isoWeek);

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];
const EVENT_COLOR_PRESETS = [
  { label: "빨강", value: "#ffd4de" },
  { label: "주황", value: "#ffe6d5" },
  { label: "노랑", value: "#fff3d7" },
  { label: "초록", value: "#e0f7d8" },
  { label: "파랑", value: "#d8eeff" },
  { label: "보라", value: "#f3def9" }
] as const;
const RECURRENCE_LABEL: Record<"none" | "daily" | "weekly" | "weekday" | "monthly" | "yearly", string> = {
  none: "없음",
  daily: "매일",
  weekly: "매주",
  weekday: "매주 월-금",
  monthly: "매월",
  yearly: "매년"
};

function kindStyle(kind: CalendarKind) {
  switch (kind) {
    case "personal":
      return "border-l-[3px] border-l-emerald-500 bg-emerald-50/95 text-emerald-950";
    case "team":
      return "border-l-[3px] border-l-blue-600 bg-blue-50/95 text-blue-950";
    default:
      return "border-l-[3px] border-l-amber-500 bg-amber-50/95 text-amber-950";
  }
}

function eventSurfaceStyle(ev: CalendarEvent): { className: string; style?: CSSProperties } {
  if (ev.color) {
    return { className: "text-slate-900", style: { backgroundColor: ev.color } };
  }
  return { className: kindStyle(ev.kind) };
}

function eventTouchesDay(ev: CalendarEvent, day: dayjs.Dayjs): boolean {
  const d0 = day.startOf("day");
  const d1 = day.endOf("day");
  return dayjs(ev.startsAt).isBefore(d1) && dayjs(ev.endsAt).isAfter(d0);
}

/** 달력상 여러 날에 걸친 일정 (가로 바 전용; 당일 일정은 칩 유지) */
function isMultiDayCalendarEvent(ev: CalendarEvent): boolean {
  return dayjs(ev.endsAt).startOf("day").isAfter(dayjs(ev.startsAt).startOf("day"));
}

/** 일정이 마지막으로 걸치는 달의 날(시작일과 같을 수 있음) */
function eventCalendarLastDay(ev: CalendarEvent): dayjs.Dayjs {
  let d = dayjs(ev.startsAt).startOf("day");
  let last = d;
  for (let n = 0; n < 400; n++) {
    if (!eventTouchesDay(ev, d)) break;
    last = d;
    d = d.add(1, "day");
  }
  return last;
}

const SPAN_BAR_H = 18;
const SPAN_BAR_GAP = 2;

type WeekSpanSegment = { ev: CalendarEvent; col0: number; col1: number; lane: number; hiddenEventIds?: string[] };

/** 한 주(7칸) 안에서 다중일 일정 가로 바 레이어: 겹치면 lane 증가 */
function layoutWeekSpanSegments(
  weekDays: dayjs.Dayjs[],
  allEvents: CalendarEvent[]
): { segments: WeekSpanSegment[]; laneCount: number; hiddenEventIds: Set<string> } {
  const raw: { ev: CalendarEvent; col0: number; col1: number }[] = [];
  const hiddenEventIds = new Set<string>();
  for (const ev of allEvents) {
    if (!isMultiDayCalendarEvent(ev)) continue;
    let col0 = -1;
    for (let i = 0; i < 7; i++) {
      if (eventTouchesDay(ev, weekDays[i])) {
        col0 = i;
        break;
      }
    }
    if (col0 < 0) continue;
    let col1 = col0;
    for (let i = 6; i >= col0; i--) {
      if (eventTouchesDay(ev, weekDays[i])) {
        col1 = i;
        break;
      }
    }
    raw.push({ ev, col0, col1 });
  }
  // 시각적 트릭: weekly/weekday/daily 반복의 같은 그룹 인스턴스를 주 단위로 연속 막대로 묶어 표시
  const visualGroupByRecurrence = new Map<
    string,
    { col: number; ev: CalendarEvent }[]
  >();
  for (const ev of allEvents) {
    if (isMultiDayCalendarEvent(ev)) continue;
    if (!ev.recurrenceGroupId) continue;
    if (!["daily", "weekly", "weekday"].includes(ev.recurrenceType ?? "none")) continue;
    const col = weekDays.findIndex((d) => d.isSame(dayjs(ev.startsAt), "day"));
    if (col < 0) continue;
    const k = `${ev.recurrenceGroupId}|${ev.title}|${ev.kind}|${ev.color ?? ""}`;
    const arr = visualGroupByRecurrence.get(k) ?? [];
    arr.push({ col, ev });
    visualGroupByRecurrence.set(k, arr);
  }
  for (const arr of visualGroupByRecurrence.values()) {
    const uniq = [...new Map(arr.map((x) => [x.col, x])).values()].sort((a, b) => a.col - b.col);
    let i = 0;
    while (i < uniq.length) {
      let j = i;
      while (j + 1 < uniq.length && uniq[j + 1].col === uniq[j].col + 1) j++;
      if (j > i) {
        const startCol = uniq[i].col;
        const endCol = uniq[j].col;
        const base = uniq[i].ev;
        raw.push({ ev: base, col0: startCol, col1: endCol });
        for (let p = i; p <= j; p++) hiddenEventIds.add(uniq[p].ev.id);
      }
      i = j + 1;
    }
  }
  raw.sort((a, b) => a.col0 - b.col0 || a.col1 - b.col1 || a.ev.id.localeCompare(b.ev.id));
  const laneEnds: number[] = [];
  const segments: WeekSpanSegment[] = [];
  for (const s of raw) {
    let lane = -1;
    for (let i = 0; i < laneEnds.length; i++) {
      if (laneEnds[i] < s.col0) {
        lane = i;
        laneEnds[i] = s.col1;
        break;
      }
    }
    if (lane < 0) {
      lane = laneEnds.length;
      laneEnds.push(s.col1);
    }
    segments.push({ ...s, lane });
  }
  return { segments, laneCount: laneEnds.length, hiddenEventIds };
}

/** 월 그리드: 포인터 아래의 `data-month-day`(YYYY-MM-DD) 셀 키 */
function monthDayKeyFromPoint(clientX: number, clientY: number): string | null {
  const el = document.elementFromPoint(clientX, clientY);
  if (!el || !(el instanceof Element)) return null;
  const hit = el.closest("[data-month-day]");
  return hit?.getAttribute("data-month-day") ?? null;
}

function dayKeyFromPoint(clientX: number, clientY: number): string | null {
  const el = document.elementFromPoint(clientX, clientY);
  if (!el || !(el instanceof Element)) return null;
  const cell = el.closest("[data-day-key]");
  const cellKey = cell?.getAttribute("data-day-key");
  if (cellKey) return cellKey;
  const monthKey = el.closest("[data-month-day]")?.getAttribute("data-month-day");
  return monthKey ?? null;
}

function moveEventToNewDay(ev: CalendarEvent, targetDay: dayjs.Dayjs): { startsAt: string; endsAt: string } {
  const os = dayjs(ev.startsAt);
  const oe = dayjs(ev.endsAt);
  const dur = oe.diff(os);
  const ns = targetDay.hour(os.hour()).minute(os.minute()).second(0).millisecond(0);
  const ne = ns.add(dur, "ms");
  return { startsAt: ns.toISOString(), endsAt: ne.toISOString() };
}

/** 해당 날짜 기준 분 단위 구간 (0–1440) */
function clampDayMinutes(ev: CalendarEvent, day: dayjs.Dayjs): { startMin: number; endMin: number } {
  const d0 = day.startOf("day");
  const startMin = Math.max(0, dayjs(ev.startsAt).diff(d0, "minute"));
  const endMin = Math.min(24 * 60, dayjs(ev.endsAt).diff(d0, "minute"));
  return { startMin, endMin };
}

function eventsOverlapMinutes(a: CalendarEvent, b: CalendarEvent, day: dayjs.Dayjs): boolean {
  const ca = clampDayMinutes(a, day);
  const cb = clampDayMinutes(b, day);
  return ca.startMin < cb.endMin && cb.startMin < ca.endMin;
}

/** 겹치는 일정을 열로 나누어 가독성 있게 배치 (그리디 열 배정 + 겹침 구간별 열 수) */
function layoutTimedEventsStack(events: CalendarEvent[], day: dayjs.Dayjs): Map<string, { col: number; colCount: number }> {
  const sorted = [...events].sort((a, b) => {
    const s = dayjs(a.startsAt).valueOf() - dayjs(b.startsAt).valueOf();
    if (s !== 0) return s;
    return dayjs(a.endsAt).valueOf() - dayjs(b.endsAt).valueOf();
  });
  const colEndMin: number[] = [];
  const assignedCol = new Map<string, number>();

  for (const ev of sorted) {
    const { startMin, endMin } = clampDayMinutes(ev, day);
    let col = -1;
    for (let c = 0; c < colEndMin.length; c++) {
      if (colEndMin[c] <= startMin) {
        col = c;
        break;
      }
    }
    if (col === -1) {
      col = colEndMin.length;
      colEndMin.push(endMin);
    } else {
      colEndMin[col] = endMin;
    }
    assignedCol.set(ev.id, col);
  }

  const out = new Map<string, { col: number; colCount: number }>();
  for (const ev of sorted) {
    const col = assignedCol.get(ev.id)!;
    const overlaps = sorted.filter((f) => eventsOverlapMinutes(ev, f, day));
    const maxCol = Math.max(...overlaps.map((f) => assignedCol.get(f.id)!));
    const colCount = maxCol + 1;
    out.set(ev.id, { col, colCount });
  }
  return out;
}

function DraggableEventChip({
  event: ev,
  compact,
  enableResize = false,
  resizeMode = "time",
  previewing = false,
  onResizeStart,
  onClick
}: {
  event: CalendarEvent;
  /** 월간 그리드: 한 줄·truncate. 일/주 시간축: 줄바꿈·겹침 열 대응 */
  compact?: boolean;
  enableResize?: boolean;
  resizeMode?: "time" | "day";
  previewing?: boolean;
  onResizeStart?: (
    ev: CalendarEvent,
    mode: "time" | "day",
    e: ReactPointerEvent<HTMLSpanElement>
  ) => void;
  onClick: (e: CalendarEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `evt-${ev.id}`,
    data: { event: ev, mode: "move" as const }
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  const surface = eventSurfaceStyle(ev);

  return (
    <button
      type="button"
      ref={setNodeRef}
      style={style ? { ...surface.style, ...style } : surface.style}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        onClick(ev);
      }}
      className={clsx(
        "pointer-events-auto relative w-full min-w-0 rounded border border-black/[0.06] px-1.5 py-0.5 text-left text-xs font-medium shadow-sm transition hover:brightness-[0.98]",
        surface.className,
        compact ? "truncate leading-tight" : "flex min-h-[28px] flex-col gap-0.5 py-1 whitespace-normal break-words [overflow-wrap:anywhere]",
        (isDragging || previewing) && "opacity-40"
      )}
    >
      {compact ? (
        <>
          {dayjs(ev.startsAt).format("HH:mm")} {ev.title}
          {ev.recurrenceGroupId ? " (반복)" : ""}
        </>
      ) : (
        <>
          <span className="text-[10px] leading-none opacity-70">{KIND_LABEL[ev.kind]}</span>
          <span className="shrink-0 text-[10px] tabular-nums leading-none opacity-80">
            {dayjs(ev.startsAt).format("HH:mm")} – {dayjs(ev.endsAt).format("HH:mm")}
          </span>
          <span className="min-w-0 text-xs font-semibold leading-snug">
            {ev.title}
            {ev.recurrenceGroupId ? " (반복)" : ""}
          </span>
        </>
      )}
      {enableResize ? (
        <span
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onResizeStart?.(ev, resizeMode, e);
          }}
          className={clsx(
            "pointer-events-auto absolute touch-none cursor-ns-resize rounded border border-black/10 bg-white/80 px-1 text-[9px] leading-none text-slate-600",
            compact ? "bottom-0 right-0" : "bottom-0.5 right-0.5",
            "opacity-80 hover:opacity-100"
          )}
          aria-label="종료 시각 조정"
          title="종료 시각 조정"
        >
          ⋮
        </span>
      ) : null}
    </button>
  );
}

/** 월/주 상단 가로 바: 여러 날에 걸친 일정 전용 (한 주 구간 내 한 덩어리) */
function DraggableSpanBar({
  dragId,
  event: ev,
  enableResize = false,
  previewing = false,
  onResizeStart,
  onClick,
  roundedLeft,
  roundedRight
}: {
  /** 주·월에서 동일 일정이 여러 행에 있을 수 있어 고유 id 필요 (`span|…`) */
  dragId: string;
  event: CalendarEvent;
  enableResize?: boolean;
  previewing?: boolean;
  onResizeStart?: (ev: CalendarEvent, mode: "day", e: ReactPointerEvent<HTMLSpanElement>) => void;
  onClick: (e: CalendarEvent) => void;
  roundedLeft: boolean;
  roundedRight: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
    data: { event: ev, mode: "move" as const }
  });
  const surface = eventSurfaceStyle(ev);
  const tStyle = transform
    ? ({ ...(surface.style ?? {}), transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } as CSSProperties)
    : surface.style;
  return (
    <button
      type="button"
      ref={setNodeRef}
      style={tStyle}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        onClick(ev);
      }}
      className={clsx(
        "pointer-events-auto relative box-border h-full min-h-0 w-full truncate border border-black/[0.06] px-1.5 text-left text-[10px] font-semibold leading-[16px] shadow-sm transition hover:brightness-[0.98]",
        surface.className,
        roundedLeft && "rounded-l-md",
        roundedRight && "rounded-r-md",
        (isDragging || previewing) && "opacity-40"
      )}
    >
      {ev.title}
      {ev.recurrenceGroupId ? " (반복)" : ""}
      {enableResize ? (
        <span
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onResizeStart?.(ev, "day", e);
          }}
          className={clsx(
            "pointer-events-auto absolute inset-y-0 right-0 flex w-2 touch-none cursor-ew-resize items-center justify-center rounded-r-md border-l border-black/10 bg-white/60 text-[9px] text-slate-600",
            "opacity-80 hover:opacity-100"
          )}
          aria-label="종료 일자 조정"
          title="종료 일자 조정"
        >
          ⋮
        </span>
      ) : null}
    </button>
  );
}

function DroppableDayCell({
  dayKey,
  isToday,
  muted,
  weekend,
  rangeHighlight,
  children
}: {
  dayKey: string;
  isToday: boolean;
  muted: boolean;
  weekend?: boolean;
  /** 월 뷰: 날짜 범위 드래그 중 선택 구간 하이라이트 */
  rangeHighlight?: boolean;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${dayKey}` });
  return (
    <div
      ref={setNodeRef}
      data-day-key={dayKey}
      className={clsx(
        "min-h-[92px] border-b border-r border-slate-200/90 bg-white p-1",
        muted && "bg-slate-100/80",
        weekend && !muted && "bg-slate-200/50",
        weekend && muted && "bg-slate-200/70",
        isToday && "bg-blue-50/60 ring-1 ring-inset ring-blue-300/80",
        isOver && "bg-brand-50/70 ring-2 ring-brand-300",
        rangeHighlight && "relative z-[2] bg-brand-100/80 ring-2 ring-inset ring-brand-400/70"
      )}
    >
      {children}
    </div>
  );
}

const SNAP_MINUTES = 15;
const MINUTES_IN_DAY = 24 * 60;

function snapToQuarterMinutes(rawMin: number): number {
  const clamped = Math.max(0, Math.min(MINUTES_IN_DAY, rawMin));
  let s = Math.round(clamped / SNAP_MINUTES) * SNAP_MINUTES;
  if (s >= MINUTES_IN_DAY) {
    s = MINUTES_IN_DAY - SNAP_MINUTES;
  }
  return s;
}

function snapSignedQuarterMinutes(rawMin: number): number {
  return Math.round(rawMin / SNAP_MINUTES) * SNAP_MINUTES;
}

/** 드래그 끝 시각을 당일 내로 맞추고, 최소 15분 구간 보장 */
function finalizeTimeRange(anchorMin: number, endMin: number): { startMin: number; endMin: number } | null {
  let a = snapToQuarterMinutes(anchorMin);
  let b = snapToQuarterMinutes(endMin);
  if (a > b) {
    [a, b] = [b, a];
  }
  if (b - a < SNAP_MINUTES) {
    b = Math.min(a + SNAP_MINUTES, MINUTES_IN_DAY - 1);
  }
  b = Math.min(b, MINUTES_IN_DAY - 1);
  if (b <= a) {
    b = Math.min(a + SNAP_MINUTES, MINUTES_IN_DAY - 1);
  }
  if (b <= a) {
    return null;
  }
  return { startMin: a, endMin: b };
}

function minutesToHHmm(day: dayjs.Dayjs, mins: number): string {
  return day.startOf("day").add(mins, "minute").format("HH:mm");
}

/**
 * 일/주 시간축 빈 영역에서만 포인터를 받습니다(상위 pointer-events-none + 이벤트 칩만 auto).
 * 이벤트 DnD·칩 클릭과 겹치지 않게 z-order로 분리합니다.
 */
function TimeGridRangeSelector({
  pixelsPerHour,
  onRangeComplete,
  disabled
}: {
  pixelsPerHour: number;
  onRangeComplete: (range: { startMin: number; endMin: number }) => void;
  disabled?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ anchor: number; current: number } | null>(null);
  const winListenersRef = useRef<{ move: (e: PointerEvent) => void; up: (e: PointerEvent) => void } | null>(
    null
  );
  const onRangeCompleteRef = useRef(onRangeComplete);
  onRangeCompleteRef.current = onRangeComplete;

  const [drag, setDrag] = useState<{ anchorMin: number; currentMin: number } | null>(null);

  const rawMinutesFromClientY = useCallback(
    (clientY: number) => {
      const el = hostRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      const y = Math.min(Math.max(0, clientY - rect.top), Math.max(0, rect.height - 0.5));
      return (y / pixelsPerHour) * 60;
    },
    [pixelsPerHour]
  );

  const removeWindowListeners = useCallback(() => {
    const l = winListenersRef.current;
    if (l) {
      window.removeEventListener("pointermove", l.move);
      window.removeEventListener("pointerup", l.up);
      window.removeEventListener("pointercancel", l.up);
      winListenersRef.current = null;
    }
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled || e.button !== 0) return;
      e.preventDefault();
      removeWindowListeners();
      const anchor = snapToQuarterMinutes(rawMinutesFromClientY(e.clientY));
      dragRef.current = { anchor, current: anchor };
      setDrag({ anchorMin: anchor, currentMin: anchor });

      const move = (ev: PointerEvent) => {
        const d = dragRef.current;
        if (!d) return;
        const cur = snapToQuarterMinutes(rawMinutesFromClientY(ev.clientY));
        dragRef.current = { anchor: d.anchor, current: cur };
        setDrag({ anchorMin: d.anchor, currentMin: cur });
      };
      const up = () => {
        const d = dragRef.current;
        dragRef.current = null;
        setDrag(null);
        removeWindowListeners();
        if (d) {
          const fin = finalizeTimeRange(d.anchor, d.current);
          if (fin) {
            onRangeCompleteRef.current(fin);
          }
        }
      };
      winListenersRef.current = { move, up };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    },
    [disabled, rawMinutesFromClientY, removeWindowListeners]
  );

  useEffect(() => {
    return () => {
      removeWindowListeners();
      dragRef.current = null;
    };
  }, [removeWindowListeners]);

  const overlay =
    drag != null
      ? (() => {
          const lo = Math.min(drag.anchorMin, drag.currentMin);
          const hi = Math.max(drag.anchorMin, drag.currentMin);
          const topPx = (lo / 60) * pixelsPerHour;
          const hPx = Math.max(((hi - lo) / 60) * pixelsPerHour, 4);
          return (
            <div
              className="pointer-events-none absolute left-1 right-1 rounded-md border border-brand-400/60 bg-brand-500/25"
              style={{ top: topPx, height: hPx }}
            />
          );
        })()
      : null;

  return (
    <div
      ref={hostRef}
      role="presentation"
      aria-hidden
      className={clsx(
        "absolute inset-0 z-[1] select-none touch-none",
        disabled ? "pointer-events-none" : "cursor-crosshair"
      )}
      onPointerDown={onPointerDown}
    >
      {overlay}
    </div>
  );
}

function WeekTimeGridRangeSelector({
  dayKeys,
  pixelsPerHour,
  disabled,
  onRangeComplete
}: {
  dayKeys: string[];
  pixelsPerHour: number;
  disabled?: boolean;
  onRangeComplete: (range: {
    startDayKey: string;
    endDayKey: string;
    startMin: number;
    endMin: number;
  }) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ dayIdx: number; min: number }[] | null>(null);
  const listenersRef = useRef<{ move: (e: PointerEvent) => void; up: () => void } | null>(null);
  const onRangeCompleteRef = useRef(onRangeComplete);
  onRangeCompleteRef.current = onRangeComplete;
  const [drag, setDrag] = useState<{ a: { dayIdx: number; min: number }; b: { dayIdx: number; min: number } } | null>(null);

  const removeListeners = useCallback(() => {
    const l = listenersRef.current;
    if (!l) return;
    window.removeEventListener("pointermove", l.move);
    window.removeEventListener("pointerup", l.up);
    window.removeEventListener("pointercancel", l.up);
    listenersRef.current = null;
  }, []);

  const pointToPos = useCallback(
    (clientX: number, clientY: number) => {
      const el = hostRef.current;
      if (!el) return { dayIdx: 0, min: 0 };
      const rect = el.getBoundingClientRect();
      const colW = rect.width / 7;
      const x = Math.min(Math.max(0, clientX - rect.left), Math.max(0, rect.width - 0.5));
      const y = Math.min(Math.max(0, clientY - rect.top), Math.max(0, rect.height - 0.5));
      const dayIdx = Math.min(6, Math.max(0, Math.floor(x / Math.max(colW, 1))));
      const min = snapToQuarterMinutes((y / pixelsPerHour) * 60);
      return { dayIdx, min };
    },
    [pixelsPerHour]
  );

  const cmp = (x: { dayIdx: number; min: number }, y: { dayIdx: number; min: number }) =>
    x.dayIdx === y.dayIdx ? x.min - y.min : x.dayIdx - y.dayIdx;

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (disabled || e.button !== 0) return;
      e.preventDefault();
      removeListeners();
      const a = pointToPos(e.clientX, e.clientY);
      dragRef.current = [a, a];
      setDrag({ a, b: a });

      const move = (ev: PointerEvent) => {
        if (!dragRef.current) return;
        const b = pointToPos(ev.clientX, ev.clientY);
        dragRef.current = [dragRef.current[0], b];
        setDrag({ a: dragRef.current[0], b });
      };
      const up = () => {
        const current = dragRef.current;
        dragRef.current = null;
        setDrag(null);
        removeListeners();
        if (!current) return;
        let [aPos, bPos] = current;
        if (cmp(aPos, bPos) > 0) {
          [aPos, bPos] = [bPos, aPos];
        }
        if (aPos.dayIdx === bPos.dayIdx) {
          const fin = finalizeTimeRange(aPos.min, bPos.min);
          if (!fin) return;
          onRangeCompleteRef.current({
            startDayKey: dayKeys[aPos.dayIdx],
            endDayKey: dayKeys[bPos.dayIdx],
            startMin: fin.startMin,
            endMin: fin.endMin
          });
          return;
        }
        onRangeCompleteRef.current({
          startDayKey: dayKeys[aPos.dayIdx],
          endDayKey: dayKeys[bPos.dayIdx],
          startMin: aPos.min,
          endMin: bPos.min
        });
      };

      listenersRef.current = { move, up };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    },
    [disabled, dayKeys, pointToPos, removeListeners]
  );

  useEffect(() => {
    return () => {
      removeListeners();
      dragRef.current = null;
    };
  }, [removeListeners]);

  const overlay =
    drag != null
      ? (() => {
          let a = drag.a;
          let b = drag.b;
          if (cmp(a, b) > 0) {
            [a, b] = [b, a];
          }
          const hpx = pixelsPerHour / 60;
          const colPct = 100 / 7;
          if (a.dayIdx === b.dayIdx) {
            const lo = Math.min(a.min, b.min);
            const hi = Math.max(a.min, b.min);
            const top = lo * hpx;
            const height = Math.max((hi - lo) * hpx, 4);
            return (
              <div
                className="pointer-events-none absolute rounded-md border border-brand-400/60 bg-brand-500/25"
                style={{
                  top,
                  height,
                  left: `${a.dayIdx * colPct}%`,
                  width: `${colPct}%`
                }}
              />
            );
          }
          const startTop = a.min * hpx;
          const startHeight = Math.max((MINUTES_IN_DAY - a.min) * hpx, 4);
          const endTop = 0;
          const endHeight = Math.max(b.min * hpx, 4);
          return (
            <>
              <div
                className="pointer-events-none absolute rounded-md border border-brand-400/60 bg-brand-500/25"
                style={{
                  top: startTop,
                  height: startHeight,
                  left: `${a.dayIdx * colPct}%`,
                  width: `${colPct}%`
                }}
              />
              {b.dayIdx - a.dayIdx > 1 && (
                <div
                  className="pointer-events-none absolute rounded-md border border-brand-400/60 bg-brand-500/25"
                  style={{
                    top: 0,
                    height: `${MINUTES_IN_DAY * hpx}px`,
                    left: `${(a.dayIdx + 1) * colPct}%`,
                    width: `${(b.dayIdx - a.dayIdx - 1) * colPct}%`
                  }}
                />
              )}
              <div
                className="pointer-events-none absolute rounded-md border border-brand-400/60 bg-brand-500/25"
                style={{
                  top: endTop,
                  height: endHeight,
                  left: `${b.dayIdx * colPct}%`,
                  width: `${colPct}%`
                }}
              />
            </>
          );
        })()
      : null;

  return (
    <div
      ref={hostRef}
      role="presentation"
      aria-hidden
      className={clsx(
        "absolute inset-0 z-[1] select-none touch-none",
        disabled ? "pointer-events-none" : "cursor-crosshair"
      )}
      onPointerDown={onPointerDown}
    >
      {overlay}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="닫기" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
            ✕
          </button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function CalendarWorkspace() {
  const qc = useQueryClient();
  const [cursor, setCursor] = useState(() => dayjs());
  const [view, setView] = useState<CalendarViewMode>("month");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [activeEv, setActiveEv] = useState<CalendarEvent | null>(null);
  const [resizeDraft, setResizeDraft] = useState<{
    eventId: string;
    startsAt: string;
    endsAt: string;
  } | null>(null);
  const resizeDraftRef = useRef<{
    eventId: string;
    startsAt: string;
    endsAt: string;
  } | null>(null);
  const [detail, setDetail] = useState<CalendarEvent | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDate, setCreateDate] = useState<string | null>(null);
  const [createTimeRange, setCreateTimeRange] = useState<{ start: string; end: string } | null>(null);
  /** 생성 모달: 월 뷰 다중 날짜 드래그 시에만 설정 */
  const [createDateRange, setCreateDateRange] = useState<{ startDate: string; endDate: string } | null>(null);
  const [createModalKey, setCreateModalKey] = useState(0);

  const [monthRangeDrag, setMonthRangeDrag] = useState<{ anchor: string; hover: string } | null>(null);
  const monthRangeSessionRef = useRef<{
    anchor: string;
    hover: string;
    sx: number;
    sy: number;
  } | null>(null);
  const monthRangeWinCleanupRef = useRef<(() => void) | null>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);
  const resizeSessionRef = useRef<{
    event: CalendarEvent;
    mode: "time" | "day";
    startX: number;
    startY: number;
    initialEnd: dayjs.Dayjs;
    initialEndDay: dayjs.Dayjs;
    initialStart: dayjs.Dayjs;
    pixelsPerHour: number;
  } | null>(null);

  useEffect(() => {
    resizeDraftRef.current = resizeDraft;
  }, [resizeDraft]);

  useEffect(() => {
    if (detail) {
      void markNavBadgeRead("calendar").catch(() => void 0);
    }
  }, [detail?.id]);

  const range = useMemo(() => {
    if (view === "month") {
      const start = cursor.startOf("month").startOf("isoWeek");
      const end = cursor.endOf("month").endOf("isoWeek");
      return { from: start.format("YYYY-MM-DD"), to: end.format("YYYY-MM-DD") };
    }
    if (view === "week") {
      const start = cursor.startOf("isoWeek");
      const end = cursor.endOf("isoWeek");
      return { from: start.format("YYYY-MM-DD"), to: end.format("YYYY-MM-DD") };
    }
    const d = cursor.format("YYYY-MM-DD");
    return { from: d, to: d };
  }, [cursor, view]);

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => fetchJson<{ users: UserOption[] }>("/api/users").then((r) => r.users)
  });

  const departmentsQuery = useQuery({
    queryKey: ["departments"],
    queryFn: () =>
      fetchJson<{
        departments: { id: string; name: string; code: string; parent_id: string | null; depth: number }[];
      }>("/api/departments").then((r) => r.departments)
  });

  const meQuery = useQuery({
    queryKey: ["chat-me"],
    queryFn: () =>
      fetchJson<{ user: { departmentId: string | null; role: "admin" | "manager" | "member" } }>("/api/chat/me").then(
        (r) => r.user
      )
  });
  const userRole = meQuery.data?.role ?? "member";
  const canUseDepartmentFilter = userRole === "admin" || userRole === "manager";

  const eventsQuery = useQuery({
    queryKey: ["events", range.from, range.to, canUseDepartmentFilter ? departmentFilter : "member-fixed"],
    queryFn: () =>
      fetchJson<{ events: CalendarEvent[] }>(
        `/api/events?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}${
          canUseDepartmentFilter && departmentFilter !== "all"
            ? `&departmentId=${encodeURIComponent(departmentFilter)}`
            : ""
        }`
      ).then((r) => r.events)
  });

  const moveMutation = useMutation({
    mutationFn: async (p: { id: string; body: Record<string, string> }) =>
      fetchJson<{ event: CalendarEvent }>(`/api/events/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p.body)
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events"] })
  });

  const updateMutation = useMutation({
    mutationFn: async (p: { id: string; body: Record<string, unknown> }) => {
      const isRecurringEdit = (detail?.recurrenceType ?? "none") !== "none";
      if (isRecurringEdit) {
        const { updateScope: _ignored, ...createBody } = p.body;
        await fetchJson(`/api/events/${p.id}`, { method: "DELETE" });
        return fetchJson<{ event: CalendarEvent }>("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createBody)
        });
      }
      return fetchJson<{ event: CalendarEvent }>(`/api/events/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p.body)
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["events"] });
      setDetail(null);
    }
  });

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      fetchJson<{ event: CalendarEvent }>("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }),
    onSuccess: () => {
      console.info("[CalendarWorkspace] create success -> invalidate ['events']");
      qc.invalidateQueries({ queryKey: ["events"] });
      setCreateOpen(false);
      setCreateTimeRange(null);
      setCreateDateRange(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetchJson(`/api/events/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      setDetail(null);
    }
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 2 } }));

  const [hideAnnouncements, setHideAnnouncements] = useState(false);
  useEffect(() => {
    try {
      setHideAnnouncements(localStorage.getItem("calendar.hideAnnouncements") === "1");
    } catch {
      void 0;
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("calendar.hideAnnouncements", hideAnnouncements ? "1" : "0");
    } catch {
      void 0;
    }
  }, [hideAnnouncements]);

  const displayEvents = useMemo(() => {
    const raw = eventsQuery.data ?? [];
    if (!hideAnnouncements) {
      return raw;
    }
    return raw.filter((e) => e.kind !== "announcement");
  }, [eventsQuery.data, hideAnnouncements]);

  const renderEvents = useMemo(() => {
    if (!resizeDraft) return displayEvents;
    return displayEvents.map((ev) =>
      ev.id === resizeDraft.eventId
        ? { ...ev, startsAt: resizeDraft.startsAt, endsAt: resizeDraft.endsAt }
        : ev
    );
  }, [displayEvents, resizeDraft]);
  const resizingEventId = resizeDraft?.eventId ?? null;

  const departmentFilterOptions = useMemo(() => {
    if (!canUseDepartmentFilter) return [];
    const rows = departmentsQuery.data ?? [];
    return rows.map((d) => ({ id: d.id, label: `${d.name} (${d.code})` }));
  }, [canUseDepartmentFilter, departmentsQuery.data]);

  useEffect(() => {
    if (!canUseDepartmentFilter && departmentFilter !== "all") {
      setDepartmentFilter("all");
    }
  }, [canUseDepartmentFilter, departmentFilter]);

  const monthCells = useMemo(() => {
    const monthStart = cursor.startOf("month");
    const gridStart = monthStart.startOf("isoWeek");
    const cells: dayjs.Dayjs[] = [];
    for (let i = 0; i < 42; i++) {
      cells.push(gridStart.add(i, "day"));
    }
    return cells;
  }, [cursor]);

  const monthWeeks = useMemo(() => {
    const rows: dayjs.Dayjs[][] = [];
    for (let i = 0; i < monthCells.length; i += 7) {
      rows.push(monthCells.slice(i, i + 7));
    }
    return rows;
  }, [monthCells]);

  const weekDays = useMemo(() => {
    const start = cursor.startOf("isoWeek");
    return Array.from({ length: 7 }, (_, i) => start.add(i, "day"));
  }, [cursor]);
  const getHolidayName = useCallback(
    (d: dayjs.Dayjs) => KOREAN_HOLIDAY_MAP_2024_2040.get(d.format("YYYY-MM-DD")) ?? null,
    []
  );
  const isWeekend = useCallback((d: dayjs.Dayjs) => {
    const wd = d.day();
    return wd === 0 || wd === 6;
  }, []);
  const weekSpanLayout = useMemo(
    () => layoutWeekSpanSegments(weekDays, renderEvents),
    [weekDays, renderEvents]
  );

  const openCreateFromMonthRange = useCallback((lo: string, hi: string) => {
    setCreateDate(lo);
    if (lo !== hi) {
      setCreateDateRange({ startDate: lo, endDate: hi });
      setCreateTimeRange({ start: "00:00", end: "23:59" });
    } else {
      setCreateDateRange(null);
      setCreateTimeRange(null);
    }
    setCreateModalKey((k) => k + 1);
    setCreateOpen(true);
  }, []);

  const openCreateFromRange = useCallback((dayKey: string, range: { startMin: number; endMin: number }) => {
    const d = dayjs(dayKey);
    setCreateDate(dayKey);
    setCreateDateRange(null);
    setCreateTimeRange({
      start: minutesToHHmm(d, range.startMin),
      end: minutesToHHmm(d, range.endMin)
    });
    setCreateModalKey((k) => k + 1);
    setCreateOpen(true);
  }, []);

  const openCreateFromWeekRange = useCallback(
    (range: { startDayKey: string; endDayKey: string; startMin: number; endMin: number }) => {
      const startDay = dayjs(range.startDayKey);
      const endDay = dayjs(range.endDayKey);
      setCreateDate(range.startDayKey);
      const sameDay = range.startDayKey === range.endDayKey;
      setCreateDateRange(
        sameDay ? null : { startDate: range.startDayKey, endDate: range.endDayKey }
      );
      setCreateTimeRange({
        start: minutesToHHmm(startDay, range.startMin),
        end: minutesToHHmm(endDay, range.endMin)
      });
      setCreateModalKey((k) => k + 1);
      setCreateOpen(true);
    },
    []
  );

  const clearMonthRangeWindowListeners = useCallback(() => {
    monthRangeWinCleanupRef.current?.();
    monthRangeWinCleanupRef.current = null;
    monthRangeSessionRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      clearMonthRangeWindowListeners();
      resizeCleanupRef.current?.();
      resizeCleanupRef.current = null;
    };
  }, [clearMonthRangeWindowListeners]);

  useEffect(() => {
    if (view !== "month" || createOpen) {
      clearMonthRangeWindowListeners();
      setMonthRangeDrag(null);
    }
  }, [view, createOpen, clearMonthRangeWindowListeners]);

  const beginResizeFromHandle = useCallback(
    (ev: CalendarEvent, mode: "time" | "day", e: ReactPointerEvent<HTMLSpanElement>) => {
      if (createOpen) return;
      resizeCleanupRef.current?.();
      resizeCleanupRef.current = null;
      const initialStart = dayjs(ev.startsAt);
      const initialEnd = dayjs(ev.endsAt);
      resizeSessionRef.current = {
        event: ev,
        mode,
        startX: e.clientX,
        startY: e.clientY,
        initialEnd,
        initialEndDay: initialEnd.startOf("day"),
        initialStart,
        pixelsPerHour: view === "day" ? 56 : 48
      };
      setResizeDraft({ eventId: ev.id, startsAt: ev.startsAt, endsAt: ev.endsAt });

      const move = (pe: PointerEvent) => {
        const sess = resizeSessionRef.current;
        if (!sess) return;
        const targetDayKey = dayKeyFromPoint(pe.clientX, pe.clientY);
        const targetDay = targetDayKey ? dayjs(targetDayKey) : sess.initialEndDay;
        const dayDiff = targetDay.startOf("day").diff(sess.initialEndDay, "day");
        const deltaMinRaw =
          sess.mode === "time"
            ? ((pe.clientY - sess.startY) / sess.pixelsPerHour) * 60
            : 0;
        const deltaMin = sess.mode === "time" ? snapSignedQuarterMinutes(deltaMinRaw) : 0;
        let nextEnd = sess.initialEnd
          .add(dayDiff, "day")
          .add(deltaMin, "minute")
          .second(0)
          .millisecond(0);
        const minEnd = sess.initialStart.add(SNAP_MINUTES, "minute");
        if (!nextEnd.isAfter(minEnd)) {
          nextEnd = minEnd;
        }
        setResizeDraft({
          eventId: sess.event.id,
          startsAt: sess.initialStart.toISOString(),
          endsAt: nextEnd.toISOString()
        });
      };

      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        resizeCleanupRef.current = null;
        const sess = resizeSessionRef.current;
        resizeSessionRef.current = null;
        if (!sess) {
          setResizeDraft(null);
          return;
        }
        const draft = resizeDraftRef.current;
        setResizeDraft(null);
        if (!draft || draft.eventId !== sess.event.id) return;
        if (draft.startsAt === sess.event.startsAt && draft.endsAt === sess.event.endsAt) return;
        moveMutation.mutate({
          id: sess.event.id,
          body: { startsAt: draft.startsAt, endsAt: draft.endsAt }
        });
      };

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
      resizeCleanupRef.current = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
      };
    },
    [createOpen, view, moveMutation]
  );

  const onMonthGridCellPointerDown = useCallback(
    (anchorKey: string, e: ReactPointerEvent<HTMLDivElement>) => {
      if (view !== "month" || createOpen) return;
      if (e.button !== 0) return;
      clearMonthRangeWindowListeners();
      const sx = e.clientX;
      const sy = e.clientY;
      monthRangeSessionRef.current = { anchor: anchorKey, hover: anchorKey, sx, sy };
      setMonthRangeDrag({ anchor: anchorKey, hover: anchorKey });

      const move = (ev: PointerEvent) => {
        const sess = monthRangeSessionRef.current;
        if (!sess) return;
        const k = monthDayKeyFromPoint(ev.clientX, ev.clientY);
        if (k) {
          sess.hover = k;
          setMonthRangeDrag({ anchor: sess.anchor, hover: k });
        }
      };

      const finish = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
        monthRangeWinCleanupRef.current = null;
        const sess = monthRangeSessionRef.current;
        monthRangeSessionRef.current = null;
        setMonthRangeDrag(null);
        if (!sess) return;
        const finalKey = monthDayKeyFromPoint(ev.clientX, ev.clientY) ?? sess.hover;
        const lo = sess.anchor <= finalKey ? sess.anchor : finalKey;
        const hi = sess.anchor <= finalKey ? finalKey : sess.anchor;
        const dist = Math.hypot(ev.clientX - sess.sx, ev.clientY - sess.sy);
        const crossCell = lo !== hi;
        if (crossCell || dist >= 12) {
          openCreateFromMonthRange(lo, hi);
        }
      };

      monthRangeWinCleanupRef.current = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
    },
    [view, createOpen, clearMonthRangeWindowListeners, openCreateFromMonthRange]
  );

  function handleDragStart(e: DragStartEvent) {
    const data = e.active.data.current as
      | { event?: CalendarEvent; mode?: "move" | "resize" | "resizeDay" }
      | undefined;
    if (data?.event) setActiveEv(data.event);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveEv(null);
    const { active, over } = e;
    if (!over) return;
    const oid = String(over.id);
    if (!oid.startsWith("day-")) return;
    const dayKey = oid.slice(4);
    const targetDay = dayjs(dayKey);
    const raw = String(active.id);
    const eventId = raw.startsWith("span|")
      ? (raw.split("|")[1] ?? "")
      : raw.startsWith("evt-")
        ? raw.slice(4)
        : raw.startsWith("rz-")
          ? raw.slice(3)
          : raw.startsWith("srz-span|")
            ? (raw.split("|")[1] ?? "")
            : raw;
    const data = active.data.current as
      | { event?: CalendarEvent; mode?: "move" | "resize" | "resizeDay" }
      | undefined;
    const ev = data?.event ?? renderEvents.find((x) => x.id === eventId);
    if (!ev) return;
    const mode = data?.mode ?? "move";

    if (view === "month") {
      if (mode === "resize" || mode === "resizeDay") {
        const start = dayjs(ev.startsAt);
        let nextEnd = dayjs(ev.endsAt)
          .year(targetDay.year())
          .month(targetDay.month())
          .date(targetDay.date())
          .second(0)
          .millisecond(0);
        const minEnd = start.add(SNAP_MINUTES, "minute");
        if (!nextEnd.isAfter(minEnd)) {
          nextEnd = minEnd;
        }
        moveMutation.mutate({
          id: ev.id,
          body: { startsAt: start.toISOString(), endsAt: nextEnd.toISOString() }
        });
        return;
      }
      if (dayjs(ev.startsAt).isSame(targetDay, "day")) return;
      const next = moveEventToNewDay(ev, targetDay);
      moveMutation.mutate({ id: ev.id, body: { startsAt: next.startsAt, endsAt: next.endsAt } });
      return;
    }

    const pixelsPerHour = view === "day" ? 56 : 48;
    const deltaMin = snapSignedQuarterMinutes((e.delta.y / pixelsPerHour) * 60);
    const start = dayjs(ev.startsAt);
    const end = dayjs(ev.endsAt);

    if (mode === "resizeDay") {
      const start = dayjs(ev.startsAt);
      let nextEnd = dayjs(ev.endsAt)
        .year(targetDay.year())
        .month(targetDay.month())
        .date(targetDay.date())
        .second(0)
        .millisecond(0);
      const minEnd = start.add(SNAP_MINUTES, "minute");
      if (!nextEnd.isAfter(minEnd)) {
        nextEnd = minEnd;
      }
      moveMutation.mutate({
        id: ev.id,
        body: { startsAt: start.toISOString(), endsAt: nextEnd.toISOString() }
      });
      return;
    }

    if (mode === "resize") {
      const endDayDiff = targetDay.startOf("day").diff(end.startOf("day"), "day");
      let nextEnd = end
        .add(endDayDiff, "day")
        .add(deltaMin, "minute")
        .second(0)
        .millisecond(0);
      const minEnd = start.add(SNAP_MINUTES, "minute");
      if (!nextEnd.isAfter(minEnd)) {
        nextEnd = minEnd;
      }
      moveMutation.mutate({
        id: ev.id,
        body: { startsAt: start.toISOString(), endsAt: nextEnd.toISOString() }
      });
      return;
    }

    const startDayDiff = targetDay.startOf("day").diff(start.startOf("day"), "day");
    const duration = end.diff(start, "millisecond");
    const nextStart = start
      .add(startDayDiff, "day")
      .add(deltaMin, "minute")
      .second(0)
      .millisecond(0);
    const nextEnd = nextStart.add(duration, "millisecond");
    moveMutation.mutate({
      id: ev.id,
      body: { startsAt: nextStart.toISOString(), endsAt: nextEnd.toISOString() }
    });
  }

  function titleText(): string {
    if (view === "month") return cursor.format("YYYY년 M월");
    if (view === "week") {
      const s = cursor.startOf("isoWeek");
      const t = cursor.endOf("isoWeek");
      return `${s.format("M월 D일")} – ${t.format("M월 D일, YYYY")}`;
    }
    return cursor.format("YYYY년 M월 D일 (ddd)");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-xl border border-b-0 border-slate-200/90 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
            onClick={() => setCursor(dayjs())}
          >
            오늘
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
              aria-label="이전"
              onClick={() =>
                setCursor((c) =>
                  view === "month" ? c.subtract(1, "month") : view === "week" ? c.subtract(1, "week") : c.subtract(1, "day")
                )
              }
            >
              ‹
            </button>
            <button
              type="button"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
              aria-label="다음"
              onClick={() =>
                setCursor((c) =>
                  view === "month" ? c.add(1, "month") : view === "week" ? c.add(1, "week") : c.add(1, "day")
                )
              }
            >
              ›
            </button>
          </div>
          <h2 className="text-lg font-semibold text-slate-900">{titleText()}</h2>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={hideAnnouncements}
              onChange={(e) => setHideAnnouncements(e.target.checked)}
            />
            전사 공지 숨기기
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canUseDepartmentFilter && (
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700">
              <span className="text-xs font-semibold text-slate-500">부서</span>
              <select
                className="bg-transparent text-sm text-slate-800 outline-none"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
              >
                <option value="all">전체</option>
                {departmentFilterOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50/80 p-0.5">
            {(["month", "week", "day"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={clsx(
                  "rounded-md px-3 py-1.5 text-sm font-medium",
                  view === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                )}
              >
                {v === "month" ? "월" : v === "week" ? "주" : "일"}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setCreateDate(cursor.format("YYYY-MM-DD"));
              setCreateDateRange(null);
              setCreateTimeRange(null);
              setCreateModalKey((k) => k + 1);
              setCreateOpen(true);
            }}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            일정 만들기
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="overflow-auto rounded-b-xl border border-slate-200/90 bg-white shadow-sm">
          {eventsQuery.isLoading && <p className="p-6 text-sm text-slate-500">불러오는 중…</p>}
          {eventsQuery.isError && (
            <p className="p-6 text-sm text-red-600">{(eventsQuery.error as Error).message}</p>
          )}
          {!eventsQuery.isLoading && view === "month" && (
            <div className="min-w-[720px]">
              <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/90">
                {WEEKDAYS.map((w, idx) => (
                  <div
                    key={w}
                    className={clsx(
                      "border-r border-slate-200 px-2 py-2 text-center text-xs font-semibold last:border-r-0",
                      idx < 5 ? "bg-slate-200/80 text-slate-600" : "text-slate-500"
                    )}
                  >
                    {w}
                  </div>
                ))}
              </div>
              {monthWeeks.map((week, weekIdx) => {
                const { segments, laneCount, hiddenEventIds } = layoutWeekSpanSegments(week, renderEvents);
                const stripPad = 4;
                const stripMinH = laneCount > 0 ? laneCount * (SPAN_BAR_H + SPAN_BAR_GAP) + stripPad : 0;
                return (
                  <div key={week[0].format("YYYY-MM-DD")} className="grid grid-cols-7 border-b border-slate-200 last:border-b-0">
                    {laneCount > 0 ? (
                      <div
                        className="relative col-span-7 box-border border-x border-slate-200/90 bg-white"
                        style={{ minHeight: stripMinH }}
                      >
                        {segments.map((s) => {
                          const lastD = eventCalendarLastDay(s.ev);
                          const isSegStart = week[s.col0].isSame(dayjs(s.ev.startsAt), "day");
                          const isSegEnd = week[s.col1].isSame(lastD, "day");
                          const leftPct = (s.col0 / 7) * 100;
                          const widthPct = ((s.col1 - s.col0 + 1) / 7) * 100;
                          const top = stripPad / 2 + s.lane * (SPAN_BAR_H + SPAN_BAR_GAP);
                          return (
                            <div
                              key={`${s.ev.id}-w${weekIdx}`}
                              className="pointer-events-auto absolute box-border px-[1px]"
                              style={{ left: `${leftPct}%`, width: `${widthPct}%`, top, height: SPAN_BAR_H }}
                            >
                              <DraggableSpanBar
                                dragId={`span|${s.ev.id}|m${weekIdx}-${week[0].format("YYYY-MM-DD")}`}
                                event={s.ev}
                                enableResize
                                previewing={resizingEventId === s.ev.id}
                                onResizeStart={beginResizeFromHandle}
                                onClick={setDetail}
                                roundedLeft={isSegStart}
                                roundedRight={isSegEnd}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                    {week.map((day) => {
                      const key = day.format("YYYY-MM-DD");
                      const inMonth = day.month() === cursor.month();
                      const today = day.isSame(dayjs(), "day");
                      const holidayName = getHolidayName(day);
                      const weekend = isWeekend(day);
                      const dayEvents = renderEvents.filter((ev) => eventTouchesDay(ev, day));
                      const chipEvents = dayEvents.filter(
                        (ev) => !isMultiDayCalendarEvent(ev) && !hiddenEventIds.has(ev.id)
                      );
                      const dragLo =
                        monthRangeDrag &&
                        (monthRangeDrag.anchor <= monthRangeDrag.hover
                          ? monthRangeDrag.anchor
                          : monthRangeDrag.hover);
                      const dragHi =
                        monthRangeDrag &&
                        (monthRangeDrag.anchor <= monthRangeDrag.hover
                          ? monthRangeDrag.hover
                          : monthRangeDrag.anchor);
                      const rangeHighlight = Boolean(
                        monthRangeDrag && dragLo && dragHi && key >= dragLo && key <= dragHi
                      );
                      return (
                        <DroppableDayCell
                          key={key}
                          dayKey={key}
                          isToday={today}
                          muted={!inMonth}
                          weekend={weekend}
                          rangeHighlight={rangeHighlight}
                        >
                          <div className="relative flex min-h-[84px] flex-col">
                            <div
                              role="presentation"
                              data-month-day={key}
                              className={clsx(
                                "absolute inset-0 z-0 touch-none select-none",
                                createOpen ? "pointer-events-none" : "cursor-crosshair"
                              )}
                              onPointerDown={(e) => onMonthGridCellPointerDown(key, e)}
                            />
                            <div className="pointer-events-none relative z-[1] flex min-h-0 flex-1 flex-col">
                              <div className="mb-1 flex justify-between">
                                <span
                                  className={clsx(
                                    "text-sm font-medium",
                                    today
                                      ? "flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white"
                                      : holidayName
                                        ? "text-red-500"
                                        : weekend
                                          ? "text-slate-400"
                                          : !inMonth
                                            ? "text-slate-400"
                                            : "text-slate-800"
                                  )}
                                >
                                  {day.date()}
                                </span>
                                {inMonth && (
                                  <button
                                    type="button"
                                    className="pointer-events-auto text-xs text-brand-600 hover:underline"
                                    onClick={() => {
                                      setCreateDate(key);
                                      setCreateDateRange(null);
                                      setCreateTimeRange(null);
                                      setCreateModalKey((k) => k + 1);
                                      setCreateOpen(true);
                                    }}
                                  >
                                    +
                                  </button>
                                )}
                              </div>
                              {holidayName ? (
                                <div className="mb-1 truncate text-[10px] font-semibold text-red-500">{holidayName}</div>
                              ) : null}
                              <div className="flex max-h-[72px] flex-col gap-0.5 overflow-hidden">
                                {chipEvents.slice(0, 3).map((ev) => (
                                  <DraggableEventChip
                                    key={ev.id}
                                    event={ev}
                                    compact
                                    enableResize
                                    resizeMode="day"
                                    previewing={resizingEventId === ev.id}
                                    onResizeStart={beginResizeFromHandle}
                                    onClick={setDetail}
                                  />
                                ))}
                                {chipEvents.length > 3 && (
                                  <span className="truncate pl-1 text-[10px] text-slate-500">
                                    +{chipEvents.length - 3}건
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </DroppableDayCell>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {!eventsQuery.isLoading && view === "week" && (
            <div className="min-w-[800px]">
              <div className="grid grid-cols-8 border-b border-slate-200 bg-slate-50/90">
                <div className="border-r border-slate-200 py-2 text-xs text-transparent">.</div>
                {weekDays.map((d) => {
                  const key = d.format("YYYY-MM-DD");
                  const today = d.isSame(dayjs(), "day");
                  const holidayName = getHolidayName(d);
                  const weekend = isWeekend(d);
                  return (
                    <div
                      key={key}
                      className={clsx(
                        "border-r border-slate-200 px-1 py-2 text-center text-xs font-semibold last:border-r-0",
                        !weekend && "bg-slate-200/80",
                        today ? "text-blue-700" : holidayName ? "text-red-500" : weekend ? "text-slate-500" : "text-slate-600"
                      )}
                    >
                      <div>{d.format("ddd")}</div>
                      <div
                        className={clsx(
                          "mx-auto mt-1 text-lg",
                          today && "flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white"
                        )}
                      >
                        {d.date()}
                      </div>
                      {holidayName ? <div className="mt-0.5 truncate text-[10px] text-red-500">{holidayName}</div> : null}
                    </div>
                  );
                })}
              </div>
              {(() => {
                const { segments, laneCount } = weekSpanLayout;
                const stripPad = 4;
                const stripMinH = laneCount > 0 ? laneCount * (SPAN_BAR_H + SPAN_BAR_GAP) + stripPad : 0;
                return (
                  <div className="grid grid-cols-8 border-b border-slate-200 bg-white">
                    <div className="border-r border-slate-200 bg-slate-50/50" aria-hidden />
                    {laneCount > 0 ? (
                      <div
                        className="relative col-span-7 box-border border-r border-slate-200/90"
                        style={{ minHeight: stripMinH }}
                      >
                        {segments.map((s) => {
                          const lastD = eventCalendarLastDay(s.ev);
                          const isSegStart = weekDays[s.col0].isSame(dayjs(s.ev.startsAt), "day");
                          const isSegEnd = weekDays[s.col1].isSame(lastD, "day");
                          const leftPct = (s.col0 / 7) * 100;
                          const widthPct = ((s.col1 - s.col0 + 1) / 7) * 100;
                          const top = stripPad / 2 + s.lane * (SPAN_BAR_H + SPAN_BAR_GAP);
                          return (
                            <div
                              key={`${s.ev.id}-weekspan`}
                              className="pointer-events-auto absolute box-border px-[1px]"
                              style={{ left: `${leftPct}%`, width: `${widthPct}%`, top, height: SPAN_BAR_H }}
                            >
                              <DraggableSpanBar
                                dragId={`span|${s.ev.id}|${weekDays[0].format("YYYY-MM-DD")}`}
                                event={s.ev}
                                enableResize
                                previewing={resizingEventId === s.ev.id}
                                onResizeStart={beginResizeFromHandle}
                                onClick={setDetail}
                                roundedLeft={isSegStart}
                                roundedRight={isSegEnd}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="col-span-7" />
                    )}
                  </div>
                );
              })()}
              <div className="relative grid grid-cols-8">
                <div className="border-r border-slate-200 bg-slate-50/50 py-1 text-right text-[10px] text-slate-400">
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} className="h-12 pr-1 leading-[48px]">
                      {h === 0 ? "" : `${h}:00`}
                    </div>
                  ))}
                </div>
                {weekDays.map((d) => {
                  const key = d.format("YYYY-MM-DD");
                  const today = d.isSame(dayjs(), "day");
                  const dayEvents = renderEvents.filter((ev) => eventTouchesDay(ev, d));
                  const timedDayEvents = dayEvents.filter(
                    (ev) => !isMultiDayCalendarEvent(ev) && !weekSpanLayout.hiddenEventIds.has(ev.id)
                  );
                  const stackMap = layoutTimedEventsStack(timedDayEvents, d);
                  return (
                    <DroppableDayCell key={key} dayKey={key} isToday={today} muted={false} weekend={isWeekend(d)}>
                      <div className="relative min-h-[1152px] min-w-[120px]">
                        <div className="relative z-0">
                          {Array.from({ length: 24 }, (_, h) => (
                            <div key={h} className="h-12 border-b border-slate-100" />
                          ))}
                        </div>
                        <div className="pointer-events-none absolute inset-0 z-[2]">
                          {timedDayEvents.map((ev) => {
                            const start = dayjs(ev.startsAt);
                            const end = dayjs(ev.endsAt);
                            const dayStart = d.startOf("day");
                            const topMin = Math.max(0, start.diff(dayStart, "minute"));
                            const endMin = Math.min(24 * 60, end.diff(dayStart, "minute"));
                            const hpx = 48;
                            const top = (topMin / 60) * hpx;
                            const height = Math.max(24, ((endMin - topMin) / 60) * hpx);
                            const stack = stackMap.get(ev.id)!;
                            const leftPct = (stack.col / stack.colCount) * 100;
                            const widthPct = 100 / stack.colCount;
                            return (
                              <div
                                key={ev.id}
                                className="pointer-events-auto absolute box-border px-0.5"
                                style={{
                                  top,
                                  height,
                                  minHeight: 28,
                                  left: `${leftPct}%`,
                                  width: `${widthPct}%`,
                                  right: "auto"
                                }}
                              >
                                <DraggableEventChip
                                  event={ev}
                                  onClick={setDetail}
                                  enableResize
                                  resizeMode="time"
                                  previewing={resizingEventId === ev.id}
                                  onResizeStart={beginResizeFromHandle}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </DroppableDayCell>
                  );
                })}
                <div className="absolute inset-y-0 left-[12.5%] right-0">
                  <WeekTimeGridRangeSelector
                    dayKeys={weekDays.map((d) => d.format("YYYY-MM-DD"))}
                    pixelsPerHour={48}
                    disabled={createOpen}
                    onRangeComplete={openCreateFromWeekRange}
                  />
                </div>
              </div>
            </div>
          )}

          {!eventsQuery.isLoading && view === "day" && (
            <div className="min-w-[min(100%,480px)]">
              {(() => {
                const holidayName = getHolidayName(cursor);
                const weekend = isWeekend(cursor);
                return (
              <div
                className={clsx(
                  "border-b border-slate-200 px-4 py-3 text-center",
                  weekend && "bg-slate-200/70",
                  cursor.isSame(dayjs(), "day") && "bg-blue-50/80"
                )}
              >
                <span
                  className={clsx(
                    "text-sm font-semibold",
                    holidayName ? "text-red-500" : weekend ? "text-slate-500" : "text-slate-800"
                  )}
                >
                  {cursor.format("YYYY년 M월 D일 dddd")}
                </span>
                {holidayName ? <span className="ml-2 text-xs font-semibold text-red-500">{holidayName}</span> : null}
              </div>
                );
              })()}
              <div className="flex min-w-0">
                <div className="w-12 shrink-0 border-r border-slate-200 bg-slate-50/50 py-1 text-right text-[10px] text-slate-400">
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} className="h-14 pr-1 leading-[56px]">
                      {h === 0 ? "" : `${h}:00`}
                    </div>
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                <DroppableDayCell
                  dayKey={cursor.format("YYYY-MM-DD")}
                  isToday={cursor.isSame(dayjs(), "day")}
                  muted={false}
                  weekend={isWeekend(cursor)}
                >
                  <div className="relative min-h-[1344px] w-full min-w-[280px]">
                    <div className="relative z-0">
                      {Array.from({ length: 24 }, (_, h) => (
                        <div key={h} className="h-14 border-b border-slate-100" />
                      ))}
                    </div>
                    <TimeGridRangeSelector
                      pixelsPerHour={56}
                      disabled={createOpen}
                      onRangeComplete={(range) =>
                        openCreateFromRange(cursor.format("YYYY-MM-DD"), range)
                      }
                    />
                    <div className="pointer-events-none absolute inset-0 z-[2]">
                      {(() => {
                        const dayEvents = renderEvents.filter((ev) => eventTouchesDay(ev, cursor));
                        const stackMap = layoutTimedEventsStack(dayEvents, cursor);
                        return dayEvents.map((ev) => {
                          const start = dayjs(ev.startsAt);
                          const end = dayjs(ev.endsAt);
                          const dayStart = cursor.startOf("day");
                          const topMin = Math.max(0, start.diff(dayStart, "minute"));
                          const endMin = Math.min(24 * 60, end.diff(dayStart, "minute"));
                          const hpx = 56;
                          const top = (topMin / 60) * hpx;
                          const height = Math.max(28, ((endMin - topMin) / 60) * hpx);
                          const stack = stackMap.get(ev.id)!;
                          const leftPct = (stack.col / stack.colCount) * 100;
                          const widthPct = 100 / stack.colCount;
                          return (
                            <div
                              key={ev.id}
                              className="pointer-events-auto absolute box-border px-1"
                              style={{
                                top,
                                height,
                                minHeight: 28,
                                left: `${leftPct}%`,
                                width: `${widthPct}%`,
                                right: "auto"
                              }}
                            >
                              <DraggableEventChip
                                event={ev}
                                onClick={setDetail}
                                enableResize
                                resizeMode="time"
                                previewing={resizingEventId === ev.id}
                                onResizeStart={beginResizeFromHandle}
                              />
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </DroppableDayCell>
                </div>
              </div>
            </div>
          )}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeEv ? (
            <div className={clsx("max-w-[200px] rounded border px-2 py-1 text-xs shadow-lg", kindStyle(activeEv.kind))}>
              {activeEv.title}
              {activeEv.recurrenceGroupId ? " (반복)" : ""}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {createOpen && (
        <EventFormModal
          key={`create-${createModalKey}`}
          mode="create"
          initialDate={createDate ?? cursor.format("YYYY-MM-DD")}
          initialTimeRange={createTimeRange}
          initialDateRange={createDateRange}
          users={usersQuery.data ?? []}
          departments={departmentsQuery.data ?? []}
          defaultDepartmentId={meQuery.data?.departmentId ?? null}
          loading={createMutation.isPending}
          error={createMutation.error as Error | null}
          onClose={() => {
            setCreateOpen(false);
            setCreateTimeRange(null);
            setCreateDateRange(null);
          }}
          onSubmit={(payload) => createMutation.mutate(payload)}
        />
      )}

      {detail && (
        <EventFormModal
          key={detail.id}
          mode="edit"
          event={detail}
          users={usersQuery.data ?? []}
          departments={departmentsQuery.data ?? []}
          defaultDepartmentId={meQuery.data?.departmentId ?? null}
          loading={updateMutation.isPending}
          error={updateMutation.error as Error | null}
          onClose={() => setDetail(null)}
          onSubmit={(payload) => updateMutation.mutate({ id: detail.id, body: payload })}
          onDelete={() => {
            if (confirm("일정을 삭제할까요?")) deleteMutation.mutate(detail.id);
          }}
          deleting={deleteMutation.isPending}
        />
      )}
    </div>
  );
}

function EventFormModal({
  mode,
  initialDate,
  initialTimeRange = null,
  initialDateRange = null,
  event,
  users,
  departments,
  defaultDepartmentId,
  loading,
  error,
  onClose,
  onSubmit,
  onDelete,
  deleting
}: {
  mode: "create" | "edit";
  initialDate?: string;
  /** 생성 모드: 시간축 드래그 등으로 전달되는 시작·종료 HH:mm */
  initialTimeRange?: { start: string; end: string } | null;
  /** 생성 모드: 월 뷰 다중 날짜 드래그 시 시작·종료 일자 */
  initialDateRange?: { startDate: string; endDate: string } | null;
  event?: CalendarEvent;
  users: UserOption[];
  departments: { id: string; name: string; code: string }[];
  defaultDepartmentId: string | null;
  loading: boolean;
  error: Error | null;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
  onDelete?: () => void;
  deleting?: boolean;
}) {
  function formatOrgUserLabel(u: UserOption): string {
    const path = u.departmentPath || u.departmentName || "미지정 조직";
    return `${path}  ${u.name}`;
  }
  const [title, setTitle] = useState(() => event?.title ?? "");
  const [description, setDescription] = useState(() => event?.description ?? "");
  const startDayInit = event
    ? dayjs(event.startsAt).format("YYYY-MM-DD")
    : (initialDateRange?.startDate ?? initialDate ?? dayjs().format("YYYY-MM-DD"));
  const endDayInit = event
    ? dayjs(event.endsAt).format("YYYY-MM-DD")
    : (initialDateRange?.endDate ?? startDayInit);
  const [dateStr, setDateStr] = useState(() => startDayInit);
  const [endDateStr, setEndDateStr] = useState(() => endDayInit);
  const [startT, setStartT] = useState(() =>
    event ? dayjs(event.startsAt).format("HH:mm") : initialTimeRange?.start ?? "09:00"
  );
  const [endT, setEndT] = useState(() =>
    event ? dayjs(event.endsAt).format("HH:mm") : initialTimeRange?.end ?? "10:00"
  );
  const [color, setColor] = useState<string | null>(() => event?.color ?? null);
  const [showRecurrencePanel, setShowRecurrencePanel] = useState<boolean>(
    () => (event?.recurrenceType ?? "none") !== "none"
  );
  const [recurrenceType, setRecurrenceType] = useState<"none" | "daily" | "weekly" | "weekday" | "monthly" | "yearly">(
    () => (event?.recurrenceType as "none" | "daily" | "weekly" | "weekday" | "monthly" | "yearly") ?? "none"
  );
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>(
    () =>
      (event?.recurrenceDays ?? "")
        .split(",")
        .map((v) => Number(v.trim()))
        .filter((v) => Number.isFinite(v) && v >= 1 && v <= 7)
  );
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<string>(
    () => event?.recurrenceEndDate ?? endDayInit
  );
  const eventRecurrenceDetail = (event?.recurrenceDetail ?? null) as Record<string, unknown> | null;
  const anchorFromStoredDetail = (() => {
    const a = eventRecurrenceDetail?.anchorStartDate;
    return typeof a === "string" && /^\d{4}-\d{2}-\d{2}$/.test(a) ? a : undefined;
  })();
  const [recurrenceStartDate, setRecurrenceStartDate] = useState<string>(
    () => anchorFromStoredDetail ?? startDayInit
  );
  const [monthlyMode, setMonthlyMode] = useState<"dayOfMonth" | "nthWeekday" | "range">(
    () =>
      eventRecurrenceDetail?.mode === "nthWeekday"
        ? "nthWeekday"
        : eventRecurrenceDetail?.mode === "range"
          ? "range"
          : "dayOfMonth"
  );
  const [monthlyDayOfMonth, setMonthlyDayOfMonth] = useState<number>(
    () => Number(eventRecurrenceDetail?.dayOfMonth ?? dayjs(startDayInit).date())
  );
  const [monthlyWeekNo, setMonthlyWeekNo] = useState<number>(
    () => Number(eventRecurrenceDetail?.weekNo ?? Math.ceil(dayjs(startDayInit).date() / 7))
  );
  const [monthlyWeekday, setMonthlyWeekday] = useState<number>(
    () => Number(eventRecurrenceDetail?.weekday ?? dayjs(startDayInit).isoWeekday())
  );
  const [monthlyRangeStartDay, setMonthlyRangeStartDay] = useState<number>(
    () => Number(eventRecurrenceDetail?.startDay ?? dayjs(startDayInit).date())
  );
  const [monthlyRangeEndDay, setMonthlyRangeEndDay] = useState<number>(
    () => Number(eventRecurrenceDetail?.endDay ?? dayjs(endDayInit).date())
  );
  const [yearlyMode, setYearlyMode] = useState<"dayOfYear" | "range">(
    () => (eventRecurrenceDetail?.mode === "yearRange" ? "range" : "dayOfYear")
  );
  const [yearlyMonth, setYearlyMonth] = useState<number>(
    () => Number(eventRecurrenceDetail?.month ?? dayjs(startDayInit).month() + 1)
  );
  const [yearlyDay, setYearlyDay] = useState<number>(
    () => Number(eventRecurrenceDetail?.day ?? dayjs(startDayInit).date())
  );
  const [yearlyRangeStartMonth, setYearlyRangeStartMonth] = useState<number>(
    () => Number(eventRecurrenceDetail?.startMonth ?? dayjs(startDayInit).month() + 1)
  );
  const [yearlyRangeStartDay, setYearlyRangeStartDay] = useState<number>(
    () => Number(eventRecurrenceDetail?.startDay ?? dayjs(startDayInit).date())
  );
  const [yearlyRangeEndMonth, setYearlyRangeEndMonth] = useState<number>(
    () => Number(eventRecurrenceDetail?.endMonth ?? dayjs(endDayInit).month() + 1)
  );
  const [yearlyRangeEndDay, setYearlyRangeEndDay] = useState<number>(
    () => Number(eventRecurrenceDetail?.endDay ?? dayjs(endDayInit).date())
  );
  const [recurrenceUpdateScope] = useState<"single" | "group">("group");
  const [kind, setKind] = useState<CalendarKind>(() => event?.kind ?? "personal");
  const [attendeeIds, setAttendeeIds] = useState<Set<string>>(
    () => new Set(event?.attendeeUserIds ?? [])
  );
  const [attendeeQuery, setAttendeeQuery] = useState("");
  const [teamDeptId, setTeamDeptId] = useState(
    () => event?.departmentId ?? defaultDepartmentId ?? ""
  );
  const attendeeCandidates = useMemo(() => {
    const q = attendeeQuery.trim().toLowerCase();
    const base =
      q.length === 0 && defaultDepartmentId
        ? users.filter((u) => u.departmentId === defaultDepartmentId)
        : users;
    if (!q) {
      return base.slice(0, 80);
    }
    return base
      .filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.departmentName ?? "").toLowerCase().includes(q) ||
          (u.departmentPath ?? "").toLowerCase().includes(q)
      )
      .slice(0, 80);
  }, [attendeeQuery, defaultDepartmentId, users]);

  /** 생성/수정 모두 시작·종료 일자 수정 가능 */
  const showEndDate = true;

  type FieldKey = "title" | "date" | "endDate" | "start" | "end" | "range" | "dept" | "repeat" | "repeatStart";
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});

  useEffect(() => {
    if (!showRecurrencePanel) return;
    if (recurrenceEndDate && recurrenceEndDate.trim().length > 0) return;
    setRecurrenceEndDate(dateStr);
  }, [showRecurrencePanel, recurrenceEndDate, dateStr]);

  useEffect(() => {
    if (!showRecurrencePanel) return;
    if (recurrenceType !== "daily" && recurrenceType !== "weekly" && recurrenceType !== "weekday") return;
    if (!recurrenceEndDate) return;
    setDateStr(recurrenceStartDate || dateStr);
    setEndDateStr(recurrenceEndDate);
  }, [showRecurrencePanel, recurrenceType, recurrenceEndDate]);

  function buildPayload(): Record<string, unknown> {
    const [sh, sm] = startT.split(":").map(Number);
    const [eh, em] = endT.split(":").map(Number);
    const effectiveRecurrenceType =
      showRecurrencePanel && recurrenceType === "none" ? "daily" : recurrenceType;
    const isContinuousRepeat =
      showRecurrencePanel &&
      (effectiveRecurrenceType === "daily" ||
        effectiveRecurrenceType === "weekly" ||
        effectiveRecurrenceType === "weekday");
    const repeatStartBaseDate = recurrenceStartDate || dateStr;
    const normalizedRecurrenceEndDate =
      recurrenceEndDate && recurrenceEndDate.trim().length > 0 ? recurrenceEndDate : repeatStartBaseDate;
    let startDateForPayload = showRecurrencePanel ? repeatStartBaseDate : dateStr;
    if (showRecurrencePanel && effectiveRecurrenceType === "monthly" && monthlyMode === "range") {
      startDateForPayload = dayjs(repeatStartBaseDate).date(Math.max(1, Math.min(31, monthlyRangeStartDay))).format("YYYY-MM-DD");
    }
    if (showRecurrencePanel && effectiveRecurrenceType === "yearly" && yearlyMode === "range") {
      const y = dayjs(repeatStartBaseDate).year();
      startDateForPayload = dayjs(`${y}-01-01`)
        .month(Math.max(1, Math.min(12, yearlyRangeStartMonth)) - 1)
        .date(Math.max(1, Math.min(31, yearlyRangeStartDay)))
        .format("YYYY-MM-DD");
    }
    const endDateForPayload = showRecurrencePanel
      ? isContinuousRepeat
        ? repeatStartBaseDate
        : effectiveRecurrenceType === "monthly" && monthlyMode === "range"
          ? dayjs(startDateForPayload).date(Math.max(1, Math.min(31, monthlyRangeEndDay))).format("YYYY-MM-DD")
          : effectiveRecurrenceType === "yearly" && yearlyMode === "range"
            ? dayjs(startDateForPayload)
                .month(Math.max(1, Math.min(12, yearlyRangeEndMonth)) - 1)
                .date(Math.max(1, Math.min(31, yearlyRangeEndDay)))
                .format("YYYY-MM-DD")
            : repeatStartBaseDate
      : endDateStr || dateStr;
    const startsAt = dayjs(startDateForPayload).hour(sh).minute(sm).second(0).millisecond(0).toISOString();
    const endsAt = dayjs(endDateForPayload).hour(eh).minute(em).second(0).millisecond(0).toISOString();
    const payload: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim() || null,
      startsAt,
      endsAt,
      color,
      kind,
      attendeeUserIds: Array.from(attendeeIds)
    };
    if (kind === "team") {
      payload.departmentId = teamDeptId || null;
    }
    if (mode === "edit" && (event?.recurrenceType ?? "none") !== "none") {
      payload.updateScope = recurrenceUpdateScope;
    }
    if (showRecurrencePanel && effectiveRecurrenceType !== "none") {
      payload.recurrenceType = effectiveRecurrenceType;
      payload.recurrenceEndDate = normalizedRecurrenceEndDate;
      payload.recurrenceStartDate = repeatStartBaseDate;
      const anchorStartDate = repeatStartBaseDate;
      if (effectiveRecurrenceType === "weekly") {
        payload.recurrenceDays = recurrenceDays;
      }
      if (effectiveRecurrenceType === "monthly") {
        payload.recurrenceDetail =
          monthlyMode === "nthWeekday"
            ? {
                mode: "nthWeekday",
                weekNo: monthlyWeekNo,
                weekday: monthlyWeekday,
                anchorStartDate
              }
            : monthlyMode === "range"
              ? {
                  mode: "range",
                  startDay: monthlyRangeStartDay,
                  endDay: monthlyRangeEndDay,
                  dayOfMonth: monthlyRangeStartDay,
                  anchorStartDate
                }
            : {
                mode: "dayOfMonth",
                dayOfMonth: monthlyDayOfMonth,
                anchorStartDate
              };
      } else if (effectiveRecurrenceType === "yearly") {
        payload.recurrenceDetail =
          yearlyMode === "range"
            ? {
                mode: "yearRange",
                startMonth: yearlyRangeStartMonth,
                startDay: yearlyRangeStartDay,
                endMonth: yearlyRangeEndMonth,
                endDay: yearlyRangeEndDay,
                month: yearlyRangeStartMonth,
                day: yearlyRangeStartDay,
                anchorStartDate
              }
            : { mode: "dayOfYear", month: yearlyMonth, day: yearlyDay, anchorStartDate };
      } else {
        payload.recurrenceDetail = { anchorStartDate };
      }
    } else {
      /** null/빈 배열을 보내면 Zod(.optional())에서 거부되므로 비반복 시 반복 필드 생략 */
      payload.recurrenceType = "none";
    }
    return payload;
  }

  return (
    <Modal title={mode === "create" ? "새 일정" : "일정 상세"} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const next: Partial<Record<FieldKey, string>> = {};
          if (!title.trim()) next.title = "제목을 입력해 주세요.";
          if (!dateStr) next.date = "날짜를 선택해 주세요.";
          if (!showRecurrencePanel && showEndDate && !endDateStr) next.endDate = "종료 날짜를 선택해 주세요.";
          if (!showRecurrencePanel && showEndDate && endDateStr && dateStr && endDateStr < dateStr) {
            next.endDate = "종료 날짜는 시작 날짜 이후여야 합니다.";
          }
          if (!startT) next.start = "시작 시간을 선택해 주세요.";
          if (!endT) next.end = "종료 시간을 선택해 주세요.";
          if (showRecurrencePanel && recurrenceType !== "none") {
            const repeatBaseStart = recurrenceStartDate || dateStr;
            if (!recurrenceEndDate) {
              next.repeat = "반복 종료일을 선택해 주세요.";
            } else if (!recurrenceStartDate) {
              next.repeatStart = "반복 시작일을 선택해 주세요.";
            } else if (recurrenceEndDate < repeatBaseStart) {
              next.repeat = "반복 종료일은 시작일 이후여야 합니다.";
            } else if (recurrenceType === "monthly" && monthlyMode === "range" && monthlyRangeEndDay < monthlyRangeStartDay) {
              next.endDate = "시작일~종료일의 일 범위가 올바르지 않습니다.";
            } else if (
              recurrenceType === "yearly" &&
              yearlyMode === "range" &&
              dayjs(`2000-${String(yearlyRangeEndMonth).padStart(2, "0")}-${String(yearlyRangeEndDay).padStart(2, "0")}`).isBefore(
                dayjs(`2000-${String(yearlyRangeStartMonth).padStart(2, "0")}-${String(yearlyRangeStartDay).padStart(2, "0")}`)
              )
            ) {
              next.endDate = "시작일~종료일의 월/일 범위가 올바르지 않습니다.";
            } else if (recurrenceType === "weekly" && recurrenceDays.length === 0) {
              next.repeat = "매주 반복은 최소 1개 요일을 선택해 주세요.";
            }
          }
          setFieldErrors(next);
          if (Object.keys(next).length > 0) return;

          const payload = buildPayload();
          console.info("[EventFormModal] recurrence state before submit", {
            showRecurrencePanel,
            recurrenceType,
            recurrenceStartDate,
            recurrenceEndDate,
            dateStr
          });
          const endDateForValidation = endDateStr || dateStr;
          const sDt = dayjs(dateStr).hour(Number(startT.split(":")[0])).minute(Number(startT.split(":")[1]));
          const eDt = dayjs(endDateForValidation).hour(Number(endT.split(":")[0])).minute(Number(endT.split(":")[1]));
          if (!eDt.isAfter(sDt)) {
            setFieldErrors({ range: "종료 시각은 시작 시각보다 늦어야 합니다." });
            return;
          }
          if (kind === "team" && !teamDeptId) {
            setFieldErrors({ dept: "팀 일정에는 부서를 선택해 주세요." });
            return;
          }
          setFieldErrors({});
          console.info("[EventFormModal] submit payload", payload);
          onSubmit(payload);
        }}
      >
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">제목</span>
          <input
            className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${
              fieldErrors.title ? "border-red-300 ring-1 ring-red-200" : "border-slate-200"
            }`}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setFieldErrors((f) => ({ ...f, title: undefined }));
            }}
          />
          {fieldErrors.title && <p className="mt-1 text-xs text-red-600">{fieldErrors.title}</p>}
        </label>
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">일시</span>
            <button
              type="button"
              className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
              onClick={() => {
                setShowRecurrencePanel((v) => {
                  const next = !v;
                  if (next && recurrenceType === "none") {
                    setRecurrenceType("daily");
                  }
                  return next;
                });
                setFieldErrors((f) => ({ ...f, repeat: undefined }));
              }}
            >
              {showRecurrencePanel ? "반복 해제" : "반복"}
            </button>
          </div>
          {!showRecurrencePanel ? (
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">{showEndDate ? "시작 날짜" : "날짜"}</span>
                <input
                  type="date"
                  className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${
                    fieldErrors.date ? "border-red-300 ring-1 ring-red-200" : "border-slate-200"
                  }`}
                  value={dateStr}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDateStr(v);
                    if (!showEndDate) setEndDateStr(v);
                    setFieldErrors((f) => ({ ...f, date: undefined, endDate: undefined, range: undefined }));
                  }}
                />
                {fieldErrors.date && <p className="mt-1 text-xs text-red-600">{fieldErrors.date}</p>}
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">종료 날짜</span>
                <input
                  type="date"
                  className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${
                    fieldErrors.endDate ? "border-red-300 ring-1 ring-red-200" : "border-slate-200"
                  }`}
                  value={endDateStr}
                  min={dateStr}
                  onChange={(e) => {
                    setEndDateStr(e.target.value);
                    setFieldErrors((f) => ({ ...f, endDate: undefined, range: undefined }));
                  }}
                />
                {fieldErrors.endDate && <p className="mt-1 text-xs text-red-600">{fieldErrors.endDate}</p>}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">시작</span>
                  <input
                    type="time"
                    step={900}
                    className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${
                      fieldErrors.start ? "border-red-300 ring-1 ring-red-200" : "border-slate-200"
                    }`}
                    value={startT}
                    onChange={(e) => {
                      setStartT(e.target.value);
                      setFieldErrors((f) => ({ ...f, start: undefined, range: undefined }));
                    }}
                  />
                  {fieldErrors.start && <p className="mt-1 text-xs text-red-600">{fieldErrors.start}</p>}
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">종료</span>
                  <input
                    type="time"
                    step={900}
                    className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${
                      fieldErrors.end ? "border-red-300 ring-1 ring-red-200" : "border-slate-200"
                    }`}
                    value={endT}
                    onChange={(e) => {
                      setEndT(e.target.value);
                      setFieldErrors((f) => ({ ...f, end: undefined, range: undefined }));
                    }}
                  />
                  {fieldErrors.end && <p className="mt-1 text-xs text-red-600">{fieldErrors.end}</p>}
                </label>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">반복 주기</span>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={recurrenceType}
                  onChange={(e) =>
                    setRecurrenceType(
                      e.target.value as "none" | "daily" | "weekly" | "weekday" | "monthly" | "yearly"
                    )
                  }
                >
                  {Object.entries(RECURRENCE_LABEL)
                    .filter(([k]) => k !== "none")
                    .map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                </select>
              </label>
              {recurrenceType === "weekly" ? (
                <div>
                  <span className="text-xs font-semibold text-slate-500">요일</span>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {WEEKDAYS.map((d, idx) => {
                      const val = idx + 1;
                      const checked = recurrenceDays.includes(val);
                      return (
                        <label key={d} className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-xs">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setRecurrenceDays((prev) =>
                                e.target.checked ? [...new Set([...prev, val])] : prev.filter((n) => n !== val)
                              )
                            }
                          />
                          {d}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">반복 시작일</span>
                <input
                  type="date"
                  className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${
                    fieldErrors.repeatStart ? "border-red-300 ring-1 ring-red-200" : "border-slate-200"
                  }`}
                  value={recurrenceStartDate}
                  onChange={(e) => {
                    setRecurrenceStartDate(e.target.value);
                    setFieldErrors((f) => ({ ...f, repeatStart: undefined, repeat: undefined, endDate: undefined }));
                  }}
                />
                {fieldErrors.repeatStart ? <p className="mt-1 text-xs text-red-600">{fieldErrors.repeatStart}</p> : null}
              </label>
              {recurrenceType === "daily" || recurrenceType === "weekly" || recurrenceType === "weekday" ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  반복 1회의 종료 날짜는 반복 종료일과 동일하게 자동 설정됩니다.
                </div>
              ) : null}
              {recurrenceType === "monthly" ? (
                <div className="grid grid-cols-3 gap-2">
                  <select
                    className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
                    value={monthlyMode}
                    onChange={(e) => setMonthlyMode(e.target.value as "dayOfMonth" | "nthWeekday" | "range")}
                  >
                    <option value="dayOfMonth">매월 n일</option>
                    <option value="nthWeekday">매월 n번째 요일</option>
                    <option value="range">시작일~종료일(n~n)</option>
                  </select>
                  {monthlyMode === "dayOfMonth" ? (
                    <input
                      type="number"
                      min={1}
                      max={31}
                      className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
                      value={monthlyDayOfMonth}
                      onChange={(e) => setMonthlyDayOfMonth(Number(e.target.value || 1))}
                    />
                  ) : monthlyMode === "nthWeekday" ? (
                    <>
                      <select
                        className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
                        value={monthlyWeekNo}
                        onChange={(e) => setMonthlyWeekNo(Number(e.target.value))}
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>{n}번째</option>
                        ))}
                      </select>
                      <select
                        className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
                        value={monthlyWeekday}
                        onChange={(e) => setMonthlyWeekday(Number(e.target.value))}
                      >
                        {WEEKDAYS.map((d, idx) => (
                          <option key={d} value={idx + 1}>{d}</option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
                        value={monthlyRangeStartDay}
                        onChange={(e) => setMonthlyRangeStartDay(Number(e.target.value || 1))}
                      />
                      <input
                        type="number"
                        min={1}
                        max={31}
                        className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
                        value={monthlyRangeEndDay}
                        onChange={(e) => setMonthlyRangeEndDay(Number(e.target.value || 1))}
                      />
                    </>
                  )}
                </div>
              ) : null}
              {recurrenceType === "yearly" ? (
                <div className="grid grid-cols-3 gap-2">
                  <select
                    className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
                    value={yearlyMode}
                    onChange={(e) => setYearlyMode(e.target.value as "dayOfYear" | "range")}
                  >
                    <option value="dayOfYear">매년 m월 n일</option>
                    <option value="range">시작일~종료일(mm-dd~mm-dd)</option>
                  </select>
                  {yearlyMode === "dayOfYear" ? (
                    <>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
                        value={yearlyMonth}
                        onChange={(e) => setYearlyMonth(Number(e.target.value || 1))}
                      />
                      <input
                        type="number"
                        min={1}
                        max={31}
                        className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
                        value={yearlyDay}
                        onChange={(e) => setYearlyDay(Number(e.target.value || 1))}
                      />
                    </>
                  ) : (
                    <>
                      <input
                        type="text"
                        readOnly
                        className="rounded-lg border border-slate-200 px-2 py-2 text-xs"
                        value={`${yearlyRangeStartMonth}-${yearlyRangeStartDay} ~ ${yearlyRangeEndMonth}-${yearlyRangeEndDay}`}
                      />
                      <div className="grid grid-cols-2 gap-1">
                        <input
                          type="number"
                          min={1}
                          max={12}
                          className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
                          value={yearlyRangeStartMonth}
                          onChange={(e) => setYearlyRangeStartMonth(Number(e.target.value || 1))}
                        />
                        <input
                          type="number"
                          min={1}
                          max={31}
                          className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
                          value={yearlyRangeStartDay}
                          onChange={(e) => setYearlyRangeStartDay(Number(e.target.value || 1))}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <input
                          type="number"
                          min={1}
                          max={12}
                          className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
                          value={yearlyRangeEndMonth}
                          onChange={(e) => setYearlyRangeEndMonth(Number(e.target.value || 1))}
                        />
                        <input
                          type="number"
                          min={1}
                          max={31}
                          className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
                          value={yearlyRangeEndDay}
                          onChange={(e) => setYearlyRangeEndDay(Number(e.target.value || 1))}
                        />
                      </div>
                    </>
                  )}
                </div>
              ) : null}
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">반복 종료일 (~까지 반복)</span>
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={recurrenceEndDate}
                  min={recurrenceStartDate || dateStr}
                  onChange={(e) => {
                    setRecurrenceEndDate(e.target.value);
                    setFieldErrors((f) => ({ ...f, repeat: undefined }));
                  }}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">시작 시간</span>
                  <input
                    type="time"
                    step={900}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={startT}
                    onChange={(e) => setStartT(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">종료 시간</span>
                  <input
                    type="time"
                    step={900}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={endT}
                    onChange={(e) => setEndT(e.target.value)}
                  />
                </label>
              </div>
              {fieldErrors.repeat ? <p className="text-xs text-red-600">{fieldErrors.repeat}</p> : null}
            </div>
          )}
        </div>
        {fieldErrors.range && (
          <p className="text-sm text-red-600" role="alert">
            {fieldErrors.range}
          </p>
        )}
        {mode === "edit" && (event?.recurrenceType ?? "none") !== "none" ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            반복 일정 저장 시 기존 그룹을 삭제한 뒤 수정 내용으로 재등록합니다.
          </p>
        ) : null}
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">구분</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as CalendarKind);
              setFieldErrors((f) => ({ ...f, dept: undefined }));
            }}
          >
            {(Object.keys(KIND_LABEL) as CalendarKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">색상</span>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={clsx(
                "rounded-lg border px-2.5 py-1 text-xs",
                color == null ? "border-slate-300 bg-slate-100 text-slate-700" : "border-slate-200 bg-white text-slate-600"
              )}
              onClick={() => setColor(null)}
            >
              기본
            </button>
            {EVENT_COLOR_PRESETS.map((c) => (
              <button
                key={c.value}
                type="button"
                aria-label={`색상 ${c.label}`}
                title={c.label}
                onClick={() => setColor(c.value)}
                className={clsx(
                  "h-7 w-7 rounded-full border transition",
                  color === c.value ? "border-slate-500 ring-2 ring-slate-300" : "border-slate-300 hover:border-slate-400"
                )}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
        </label>
        {kind === "team" ? (
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">부서 (팀 일정)</span>
            <select
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${
                fieldErrors.dept ? "border-red-300 ring-1 ring-red-200" : "border-slate-200"
              }`}
              value={teamDeptId}
              onChange={(e) => {
                setTeamDeptId(e.target.value);
                setFieldErrors((f) => ({ ...f, dept: undefined }));
              }}
            >
              <option value="">부서 선택</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
            {fieldErrors.dept && <p className="mt-1 text-xs text-red-600">{fieldErrors.dept}</p>}
          </label>
        ) : null}
        {event?.createdByUser ? (
          <div className="block">
            <span className="text-xs font-semibold text-slate-500">등록자</span>
            <p className="mt-1 text-sm text-slate-700">
              {event.createdByUser.name} ({event.createdByUser.departmentName ?? "부서 미지정"})
            </p>
          </div>
        ) : null}
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">참석자</span>
          {attendeeIds.size > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {Array.from(attendeeIds).map((id) => {
                const user = users.find((u) => u.id === id);
                if (!user) return null;
                return (
                  <span key={id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                    {formatOrgUserLabel(user)}
                    <button
                      type="button"
                      onClick={() =>
                        setAttendeeIds((prev) => {
                          const next = new Set(prev);
                          next.delete(id);
                          return next;
                        })
                      }
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          ) : null}
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={attendeeQuery}
            onChange={(e) => setAttendeeQuery(e.target.value)}
            placeholder="이름/이메일/조직 검색"
          />
          <div className="mt-1 max-h-36 overflow-y-auto rounded-lg border border-slate-200">
            {attendeeCandidates.map((u) => (
              <label key={u.id} className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={attendeeIds.has(u.id)}
                  onChange={(e) =>
                    setAttendeeIds((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(u.id);
                      else next.delete(u.id);
                      return next;
                    })
                  }
                />
                <span className="truncate">{formatOrgUserLabel(u)}</span>
              </label>
            ))}
          </div>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">설명</span>
          <textarea
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        {error && <p className="text-sm text-red-600">{error.message}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
          {mode === "edit" && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {deleting ? "삭제 중…" : "삭제"}
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "저장 중…" : mode === "create" ? "만들기" : "저장"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
