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
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { markNavBadgeRead } from "@/lib/nav-badge-read";
import type { UserOption } from "@/types/tasks";
import {
  KIND_LABEL,
  type CalendarEvent,
  type CalendarKind,
  type CalendarViewMode
} from "@/types/calendar";

dayjs.extend(isoWeek);

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

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

function eventTouchesDay(ev: CalendarEvent, day: dayjs.Dayjs): boolean {
  const d0 = day.startOf("day");
  const d1 = day.endOf("day");
  return dayjs(ev.startsAt).isBefore(d1) && dayjs(ev.endsAt).isAfter(d0);
}

/** 월 그리드: 포인터 아래의 `data-month-day`(YYYY-MM-DD) 셀 키 */
function monthDayKeyFromPoint(clientX: number, clientY: number): string | null {
  const el = document.elementFromPoint(clientX, clientY);
  if (!el || !(el instanceof Element)) return null;
  const hit = el.closest("[data-month-day]");
  return hit?.getAttribute("data-month-day") ?? null;
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
  onClick
}: {
  event: CalendarEvent;
  /** 월간 그리드: 한 줄·truncate. 일/주 시간축: 줄바꿈·겹침 열 대응 */
  compact?: boolean;
  onClick: (e: CalendarEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `evt-${ev.id}`,
    data: { event: ev }
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <button
      type="button"
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        onClick(ev);
      }}
      className={clsx(
        "pointer-events-auto w-full min-w-0 rounded border border-black/[0.06] px-1.5 py-0.5 text-left text-xs font-medium shadow-sm transition hover:brightness-[0.98]",
        kindStyle(ev.kind),
        compact ? "truncate leading-tight" : "flex min-h-[28px] flex-col gap-0.5 py-1 whitespace-normal break-words [overflow-wrap:anywhere]",
        isDragging && "opacity-40"
      )}
    >
      {compact ? (
        <>
          {dayjs(ev.startsAt).format("HH:mm")} {ev.title}
        </>
      ) : (
        <>
          <span className="text-[10px] leading-none opacity-70">{KIND_LABEL[ev.kind]}</span>
          <span className="shrink-0 text-[10px] tabular-nums leading-none opacity-80">
            {dayjs(ev.startsAt).format("HH:mm")} – {dayjs(ev.endsAt).format("HH:mm")}
          </span>
          <span className="min-w-0 text-xs font-semibold leading-snug">{ev.title}</span>
        </>
      )}
    </button>
  );
}

function DroppableDayCell({
  dayKey,
  isToday,
  muted,
  rangeHighlight,
  children
}: {
  dayKey: string;
  isToday: boolean;
  muted: boolean;
  /** 월 뷰: 날짜 범위 드래그 중 선택 구간 하이라이트 */
  rangeHighlight?: boolean;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${dayKey}` });
  return (
    <div
      ref={setNodeRef}
      className={clsx(
        "min-h-[92px] border-b border-r border-slate-200/90 bg-white p-1",
        muted && "bg-slate-50/80",
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
  const [activeEv, setActiveEv] = useState<CalendarEvent | null>(null);
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

  const eventsQuery = useQuery({
    queryKey: ["events", range.from, range.to],
    queryFn: () =>
      fetchJson<{ events: CalendarEvent[] }>(
        `/api/events?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`
      ).then((r) => r.events)
  });

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
      fetchJson<{ user: { departmentId: string | null } }>("/api/chat/me").then((r) => r.user)
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
    mutationFn: async (p: { id: string; body: Record<string, unknown> }) =>
      fetchJson<{ event: CalendarEvent }>(`/api/events/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p.body)
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

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

  const monthCells = useMemo(() => {
    const monthStart = cursor.startOf("month");
    const gridStart = monthStart.startOf("isoWeek");
    const cells: dayjs.Dayjs[] = [];
    for (let i = 0; i < 42; i++) {
      cells.push(gridStart.add(i, "day"));
    }
    return cells;
  }, [cursor]);

  const weekDays = useMemo(() => {
    const start = cursor.startOf("isoWeek");
    return Array.from({ length: 7 }, (_, i) => start.add(i, "day"));
  }, [cursor]);

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
    };
  }, [clearMonthRangeWindowListeners]);

  useEffect(() => {
    if (view !== "month" || createOpen) {
      clearMonthRangeWindowListeners();
      setMonthRangeDrag(null);
    }
  }, [view, createOpen, clearMonthRangeWindowListeners]);

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
        const lo = sess.anchor <= sess.hover ? sess.anchor : sess.hover;
        const hi = sess.anchor <= sess.hover ? sess.hover : sess.anchor;
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
    const data = e.active.data.current as { event?: CalendarEvent } | undefined;
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
    const id = String(active.id).replace("evt-", "");
    const ev = displayEvents.find((x) => x.id === id);
    if (!ev) return;
    if (dayjs(ev.startsAt).isSame(targetDay, "day")) return;
    const next = moveEventToNewDay(ev, targetDay);
    moveMutation.mutate({ id: ev.id, body: { startsAt: next.startsAt, endsAt: next.endsAt } });
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
                {WEEKDAYS.map((w) => (
                  <div key={w} className="border-r border-slate-200 px-2 py-2 text-center text-xs font-semibold text-slate-500 last:border-r-0">
                    {w}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthCells.map((day) => {
                  const key = day.format("YYYY-MM-DD");
                  const inMonth = day.month() === cursor.month();
                  const today = day.isSame(dayjs(), "day");
                  const dayEvents = displayEvents.filter((ev) => eventTouchesDay(ev, day));
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
                  const rangeHighlight = Boolean(monthRangeDrag && dragLo && dragHi && key >= dragLo && key <= dragHi);
                  return (
                    <DroppableDayCell
                      key={key}
                      dayKey={key}
                      isToday={today}
                      muted={!inMonth}
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
                          <div className="flex max-h-[72px] flex-col gap-0.5 overflow-hidden">
                            {dayEvents.slice(0, 3).map((ev) => (
                              <DraggableEventChip key={ev.id} event={ev} compact onClick={setDetail} />
                            ))}
                            {dayEvents.length > 3 && (
                              <span className="truncate pl-1 text-[10px] text-slate-500">
                                +{dayEvents.length - 3}건
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </DroppableDayCell>
                  );
                })}
              </div>
            </div>
          )}

          {!eventsQuery.isLoading && view === "week" && (
            <div className="min-w-[800px]">
              <div className="grid grid-cols-8 border-b border-slate-200 bg-slate-50/90">
                <div className="border-r border-slate-200 py-2 text-xs text-transparent">.</div>
                {weekDays.map((d) => {
                  const key = d.format("YYYY-MM-DD");
                  const today = d.isSame(dayjs(), "day");
                  return (
                    <div
                      key={key}
                      className={clsx(
                        "border-r border-slate-200 px-1 py-2 text-center text-xs font-semibold last:border-r-0",
                        today ? "text-blue-700" : "text-slate-600"
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
                    </div>
                  );
                })}
              </div>
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
                  const dayEvents = displayEvents.filter((ev) => eventTouchesDay(ev, d));
                  const stackMap = layoutTimedEventsStack(dayEvents, d);
                  return (
                    <DroppableDayCell key={key} dayKey={key} isToday={today} muted={false}>
                      <div className="relative min-h-[1152px] min-w-[120px]">
                        <div className="relative z-0">
                          {Array.from({ length: 24 }, (_, h) => (
                            <div key={h} className="h-12 border-b border-slate-100" />
                          ))}
                        </div>
                        <div className="pointer-events-none absolute inset-0 z-[2]">
                          {dayEvents.map((ev) => {
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
                                <DraggableEventChip event={ev} onClick={setDetail} />
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
              <div
                className={clsx(
                  "border-b border-slate-200 px-4 py-3 text-center",
                  cursor.isSame(dayjs(), "day") && "bg-blue-50/80"
                )}
              >
                <span className="text-sm font-semibold text-slate-800">{cursor.format("YYYY년 M월 D일 dddd")}</span>
              </div>
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
                        const dayEvents = displayEvents.filter((ev) => eventTouchesDay(ev, cursor));
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
                              <DraggableEventChip event={ev} onClick={setDetail} />
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

  /** 생성: 항상 시작·종료 일자 선택 가능. 편집: 달력상 여러 날인 일정만 종료 일자 필드 표시 */
  const showEndDate =
    mode === "create"
      ? true
      : Boolean(
          event &&
            dayjs(event.endsAt).format("YYYY-MM-DD") !== dayjs(event.startsAt).format("YYYY-MM-DD")
        );

  type FieldKey = "title" | "date" | "endDate" | "start" | "end" | "range" | "dept";
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});

  function buildPayload(): Record<string, unknown> {
    const [sh, sm] = startT.split(":").map(Number);
    const [eh, em] = endT.split(":").map(Number);
    const startsAt = dayjs(dateStr).hour(sh).minute(sm).second(0).millisecond(0).toISOString();
    const endsAt = dayjs(endDateStr).hour(eh).minute(em).second(0).millisecond(0).toISOString();
    const payload: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim() || null,
      startsAt,
      endsAt,
      kind,
      attendeeUserIds: Array.from(attendeeIds)
    };
    if (kind === "team") {
      payload.departmentId = teamDeptId || null;
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
          if (showEndDate && !endDateStr) next.endDate = "종료 날짜를 선택해 주세요.";
          if (showEndDate && endDateStr && dateStr && endDateStr < dateStr) {
            next.endDate = "종료 날짜는 시작 날짜 이후여야 합니다.";
          }
          if (!startT) next.start = "시작 시간을 선택해 주세요.";
          if (!endT) next.end = "종료 시간을 선택해 주세요.";
          setFieldErrors(next);
          if (Object.keys(next).length > 0) return;

          const payload = buildPayload();
          const sDt = dayjs(dateStr).hour(Number(startT.split(":")[0])).minute(Number(startT.split(":")[1]));
          const eDt = dayjs(endDateStr).hour(Number(endT.split(":")[0])).minute(Number(endT.split(":")[1]));
          if (!eDt.isAfter(sDt)) {
            setFieldErrors({ range: "종료 시각은 시작 시각보다 늦어야 합니다." });
            return;
          }
          if (kind === "team" && !teamDeptId) {
            setFieldErrors({ dept: "팀 일정에는 부서를 선택해 주세요." });
            return;
          }
          setFieldErrors({});
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
        {showEndDate ? (
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
        ) : null}
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
        {fieldErrors.range && (
          <p className="text-sm text-red-600" role="alert">
            {fieldErrors.range}
          </p>
        )}
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
