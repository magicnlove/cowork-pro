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
import { ReactNode, useEffect, useMemo, useState } from "react";
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

function moveEventToNewDay(ev: CalendarEvent, targetDay: dayjs.Dayjs): { startsAt: string; endsAt: string } {
  const os = dayjs(ev.startsAt);
  const oe = dayjs(ev.endsAt);
  const dur = oe.diff(os);
  const ns = targetDay.hour(os.hour()).minute(os.minute()).second(0).millisecond(0);
  const ne = ns.add(dur, "ms");
  return { startsAt: ns.toISOString(), endsAt: ne.toISOString() };
}

function DraggableEventChip({
  event: ev,
  compact,
  onClick
}: {
  event: CalendarEvent;
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
        "w-full rounded border border-black/[0.06] px-1.5 py-0.5 text-left text-xs font-medium shadow-sm transition hover:brightness-[0.98]",
        kindStyle(ev.kind),
        compact ? "truncate leading-tight" : "py-1",
        isDragging && "opacity-40"
      )}
    >
      {!compact && <span className="mr-1 text-[10px] opacity-70">{KIND_LABEL[ev.kind]}</span>}
      {dayjs(ev.startsAt).format("HH:mm")} {ev.title}
    </button>
  );
}

function DroppableDayCell({
  dayKey,
  isToday,
  muted,
  children
}: {
  dayKey: string;
  isToday: boolean;
  muted: boolean;
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
        isOver && "bg-brand-50/70 ring-2 ring-brand-300"
      )}
    >
      {children}
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
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetchJson(`/api/events/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      setDetail(null);
    }
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

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
                  return (
                    <DroppableDayCell key={key} dayKey={key} isToday={today} muted={!inMonth}>
                      <div className="mb-1 flex justify-between">
                        <span
                          className={clsx(
                            "text-sm font-medium",
                            today ? "flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white" : "text-slate-800"
                          )}
                        >
                          {day.date()}
                        </span>
                        {inMonth && (
                          <button
                            type="button"
                            className="text-xs text-brand-600 hover:underline"
                            onClick={() => {
                              setCreateDate(key);
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
                          <span className="truncate pl-1 text-[10px] text-slate-500">+{dayEvents.length - 3}건</span>
                        )}
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
              <div className="grid grid-cols-8">
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
                  return (
                    <DroppableDayCell key={key} dayKey={key} isToday={today} muted={false}>
                      <div className="relative min-h-[1152px]">
                        {Array.from({ length: 24 }, (_, h) => (
                          <div key={h} className="h-12 border-b border-slate-100" />
                        ))}
                        {dayEvents.map((ev) => {
                          const start = dayjs(ev.startsAt);
                          const end = dayjs(ev.endsAt);
                          const dayStart = d.startOf("day");
                          const topMin = Math.max(0, start.diff(dayStart, "minute"));
                          const endMin = Math.min(24 * 60, end.diff(dayStart, "minute"));
                          const hpx = 48;
                          const top = (topMin / 60) * hpx;
                          const height = Math.max(24, ((endMin - topMin) / 60) * hpx);
                          return (
                            <div
                              key={ev.id}
                              className="absolute left-0 right-0 px-0.5"
                              style={{ top, height, minHeight: 28 }}
                            >
                              <DraggableEventChip event={ev} onClick={setDetail} />
                            </div>
                          );
                        })}
                      </div>
                    </DroppableDayCell>
                  );
                })}
              </div>
            </div>
          )}

          {!eventsQuery.isLoading && view === "day" && (
            <div className="min-w-[360px]">
              <div
                className={clsx(
                  "border-b border-slate-200 px-4 py-3 text-center",
                  cursor.isSame(dayjs(), "day") && "bg-blue-50/80"
                )}
              >
                <span className="text-sm font-semibold text-slate-800">{cursor.format("YYYY년 M월 D일 dddd")}</span>
              </div>
              <div className="flex">
                <div className="w-12 shrink-0 border-r border-slate-200 bg-slate-50/50 py-1 text-right text-[10px] text-slate-400">
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} className="h-14 pr-1 leading-[56px]">
                      {h === 0 ? "" : `${h}:00`}
                    </div>
                  ))}
                </div>
                <DroppableDayCell
                  dayKey={cursor.format("YYYY-MM-DD")}
                  isToday={cursor.isSame(dayjs(), "day")}
                  muted={false}
                >
                  <div className="relative min-h-[1344px]">
                    {Array.from({ length: 24 }, (_, h) => (
                      <div key={h} className="h-14 border-b border-slate-100" />
                    ))}
                    {displayEvents
                      .filter((ev) => eventTouchesDay(ev, cursor))
                      .map((ev) => {
                        const start = dayjs(ev.startsAt);
                        const end = dayjs(ev.endsAt);
                        const dayStart = cursor.startOf("day");
                        const topMin = Math.max(0, start.diff(dayStart, "minute"));
                        const endMin = Math.min(24 * 60, end.diff(dayStart, "minute"));
                        const hpx = 56;
                        const top = (topMin / 60) * hpx;
                        const height = Math.max(28, ((endMin - topMin) / 60) * hpx);
                        return (
                          <div
                            key={ev.id}
                            className="absolute left-0 right-0 px-1"
                            style={{ top, height }}
                          >
                            <DraggableEventChip event={ev} onClick={setDetail} />
                          </div>
                        );
                      })}
                  </div>
                </DroppableDayCell>
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
          key={createDate ?? "create"}
          mode="create"
          initialDate={createDate ?? cursor.format("YYYY-MM-DD")}
          users={usersQuery.data ?? []}
          departments={departmentsQuery.data ?? []}
          defaultDepartmentId={meQuery.data?.departmentId ?? null}
          loading={createMutation.isPending}
          error={createMutation.error as Error | null}
          onClose={() => setCreateOpen(false)}
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
  const [dateStr, setDateStr] = useState(() =>
    event ? dayjs(event.startsAt).format("YYYY-MM-DD") : initialDate ?? dayjs().format("YYYY-MM-DD")
  );
  const [startT, setStartT] = useState(() => (event ? dayjs(event.startsAt).format("HH:mm") : "09:00"));
  const [endT, setEndT] = useState(() => (event ? dayjs(event.endsAt).format("HH:mm") : "10:00"));
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

  type FieldKey = "title" | "date" | "start" | "end" | "range" | "dept";
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});

  function buildPayload(): Record<string, unknown> {
    const [sh, sm] = startT.split(":").map(Number);
    const [eh, em] = endT.split(":").map(Number);
    const base = dayjs(dateStr).hour(sh).minute(sm).second(0).millisecond(0);
    const startsAt = base.toISOString();
    const endsAt = base
      .hour(eh)
      .minute(em)
      .second(0)
      .millisecond(0)
      .toISOString();
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
          if (!startT) next.start = "시작 시간을 선택해 주세요.";
          if (!endT) next.end = "종료 시간을 선택해 주세요.";
          setFieldErrors(next);
          if (Object.keys(next).length > 0) return;

          const payload = buildPayload();
          if (new Date(String(payload.endsAt)) <= new Date(String(payload.startsAt))) {
            setFieldErrors({ range: "종료 시간은 시작 시간보다 늦어야 합니다." });
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
          <span className="text-xs font-semibold text-slate-500">날짜</span>
          <input
            type="date"
            className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${
              fieldErrors.date ? "border-red-300 ring-1 ring-red-200" : "border-slate-200"
            }`}
            value={dateStr}
            onChange={(e) => {
              setDateStr(e.target.value);
              setFieldErrors((f) => ({ ...f, date: undefined }));
            }}
          />
          {fieldErrors.date && <p className="mt-1 text-xs text-red-600">{fieldErrors.date}</p>}
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">시작</span>
            <input
              type="time"
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
