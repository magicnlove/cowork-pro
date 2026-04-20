"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { fetchJson } from "@/lib/fetch-json";
import { markActivityFeedNavBadgeRead } from "@/lib/nav-badge-read";
import type { ActivityFilter, ActivityItemDTO } from "@/types/activity";

dayjs.extend(isoWeek);

const FILTERS: Array<{ id: ActivityFilter; label: string }> = [
  { id: "all", label: "전체" },
  { id: "chat", label: "채팅" },
  { id: "task", label: "태스크" },
  { id: "note", label: "노트" },
  { id: "file", label: "파일" },
  { id: "calendar", label: "캘린더" },
  { id: "document", label: "문서" }
];

const ACTION_LABEL: Record<string, string> = {
  message_sent: "메시지 전송",
  task_created: "태스크 생성",
  task_moved: "태스크 이동",
  task_completed: "태스크 완료",
  note_created: "노트 생성",
  note_updated: "노트 수정",
  file_uploaded: "파일 업로드",
  event_created: "일정 생성",
  member_joined: "멤버 참여",
  document_viewed: "문서 조회",
  document_created: "문서 생성",
  document_updated: "문서 수정",
  document_version_created: "문서 버전 생성",
  document_approved: "문서 승인",
  document_archived: "문서 아카이브",
  workspace_member_role_changed: "워크스페이스 권한 변경"
};

const DATE_PRESETS = [
  { id: "all" as const, label: "전체 기간" },
  { id: "today" as const, label: "오늘" },
  { id: "week" as const, label: "이번 주" },
  { id: "month" as const, label: "이번 달" },
  { id: "custom" as const, label: "직접 설정" }
];

type DatePresetId = (typeof DATE_PRESETS)[number]["id"];

function activityCardStyle(entityType: ActivityItemDTO["entityType"]): string {
  switch (entityType) {
    case "channel":
      return "border-sky-200 bg-sky-50/70 hover:bg-sky-100/70";
    case "task":
      return "border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/70";
    case "note":
      return "border-fuchsia-200 bg-fuchsia-50/60 hover:bg-fuchsia-100/60";
    case "file":
      return "border-amber-200 bg-amber-50/70 hover:bg-amber-100/70";
    case "event":
      return "border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100/70";
    case "document":
      return "border-violet-200 bg-violet-50/70 hover:bg-violet-100/70";
    case "workspace":
      return "border-teal-200 bg-teal-50/70 hover:bg-teal-100/70";
    default:
      return "border-slate-200 bg-slate-50/70 hover:bg-slate-100/70";
  }
}

type OnlineUser = {
  id: string;
  name: string;
  email: string;
  departmentName: string | null;
};

function buildDateRange(
  preset: DatePresetId,
  customFrom: string,
  customTo: string
): { dateFrom: string | null; dateTo: string | null } {
  const now = dayjs();
  switch (preset) {
    case "all":
      return { dateFrom: null, dateTo: null };
    case "today":
      return {
        dateFrom: now.startOf("day").toISOString(),
        dateTo: now.endOf("day").toISOString()
      };
    case "week":
      return {
        dateFrom: now.startOf("isoWeek").toISOString(),
        dateTo: now.endOf("day").toISOString()
      };
    case "month":
      return {
        dateFrom: now.startOf("month").toISOString(),
        dateTo: now.endOf("day").toISOString()
      };
    case "custom": {
      const from =
        customFrom.trim() !== "" ? dayjs(customFrom).startOf("day") : null;
      const to = customTo.trim() !== "" ? dayjs(customTo).endOf("day") : null;
      return {
        dateFrom: from?.toISOString() ?? null,
        dateTo: to?.toISOString() ?? null
      };
    }
    default:
      return { dateFrom: null, dateTo: null };
  }
}

export function ActivityFeedWorkspace() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [datePreset, setDatePreset] = useState<DatePresetId>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const onlineSetRef = useRef<Set<string>>(new Set());
  const [onlineIds, setOnlineIds] = useState<string[]>([]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(searchInput.trim()), 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { dateFrom, dateTo } = useMemo(
    () => buildDateRange(datePreset, customFrom, customTo),
    [datePreset, customFrom, customTo]
  );

  const feedQuery = useInfiniteQuery({
    queryKey: ["activity-feed", filter, debouncedQ, dateFrom, dateTo],
    queryFn: ({ pageParam }) => {
      const cursor = pageParam as { cursorCreatedAt: string; cursorId: string } | null;
      const qs = new URLSearchParams({ filter, limit: "20" });
      if (cursor?.cursorCreatedAt && cursor?.cursorId) {
        qs.set("cursorCreatedAt", cursor.cursorCreatedAt);
        qs.set("cursorId", cursor.cursorId);
      }
      if (debouncedQ) {
        qs.set("q", debouncedQ);
      }
      if (dateFrom) {
        qs.set("dateFrom", dateFrom);
      }
      if (dateTo) {
        qs.set("dateTo", dateTo);
      }
      return fetchJson<{
        items: ActivityItemDTO[];
        nextCursor: { cursorCreatedAt: string; cursorId: string } | null;
      }>(`/api/activity?${qs.toString()}`);
    },
    initialPageParam: null as { cursorCreatedAt: string; cursorId: string } | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor
  });

  const deleteActivity = useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ ok: boolean }>(`/api/activity/${id}`, { method: "DELETE" }),
    onSuccess: async (_, id) => {
      await qc.cancelQueries({ queryKey: ["activity-feed"] });
      qc.setQueriesData({ queryKey: ["activity-feed"], exact: false }, (old) => {
        if (!old || typeof old !== "object" || !("pages" in old)) {
          return old;
        }
        const o = old as { pages: Array<{ items: ActivityItemDTO[] }> };
        return {
          ...o,
          pages: o.pages.map((page) => ({
            ...page,
            items: page.items.filter((it) => it.id !== id)
          }))
        };
      });
    }
  });

  const onlineQuery = useQuery({
    queryKey: ["activity-online"],
    queryFn: () => fetchJson<{ users: OnlineUser[] }>("/api/activity/online").then((r) => r.users),
    refetchInterval: 60_000
  });

  const items = useMemo(
    () => (feedQuery.data?.pages ?? []).flatMap((p) => p.items),
    [feedQuery.data?.pages]
  );

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const obs = new IntersectionObserver((entries) => {
      const first = entries[0];
      if (first?.isIntersecting && feedQuery.hasNextPage && !feedQuery.isFetchingNextPage) {
        void feedQuery.fetchNextPage();
      }
    });
    obs.observe(node);
    return () => obs.disconnect();
  }, [feedQuery]);

  useEffect(() => {
    void markActivityFeedNavBadgeRead().catch(() => void 0);
  }, []);

  useEffect(() => {
    const socket = io({
      path: "/socket.io/",
      withCredentials: true,
      transports: ["websocket", "polling"]
    });
    socket.on("activity:new", () => {
      void qc.invalidateQueries({ queryKey: ["activity-feed"] });
      void qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    });
    socket.on("activity:online", (payload: { userIds?: string[] }) => {
      const ids = Array.isArray(payload?.userIds) ? payload.userIds : [];
      onlineSetRef.current = new Set(ids);
      setOnlineIds(ids);
      void qc.invalidateQueries({ queryKey: ["activity-online"] });
    });
    return () => {
      socket.removeAllListeners();
      socket.close();
    };
  }, [qc]);

  const onlineUsers = useMemo(() => {
    const base = onlineQuery.data ?? [];
    if (onlineIds.length === 0) {
      return base;
    }
    const s = new Set(onlineIds);
    return base.filter((u) => s.has(u.id));
  }, [onlineIds, onlineQuery.data]);

  return (
    <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[1fr_280px]">
      <section className="card-brand min-h-0 rounded-2xl p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="block min-w-[200px] flex-1 text-sm">
            <span className="text-slate-600">검색</span>
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="활동 내용, 사용자, 항목 이름"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <div className="flex flex-wrap gap-1">
            <span className="mr-1 w-full text-xs text-slate-500 sm:mr-0 sm:w-auto sm:self-center">
              기간
            </span>
            {DATE_PRESETS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDatePreset(d.id)}
                className={`rounded-lg px-2.5 py-1 text-xs ${
                  datePreset === d.id
                    ? "bg-slate-800 font-medium text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
        {datePreset === "custom" ? (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="text-slate-600">시작일</span>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="mt-1 block rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="text-slate-600">종료일</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="mt-1 block rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                filter === f.id
                  ? "bg-brand-600 font-semibold text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className={`flex gap-2 rounded-xl border p-3 ${activityCardStyle(item.entityType)}`}
            >
              <Link
                href={item.link}
                className="min-w-0 flex-1 block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <p className="text-sm font-medium text-slate-900">
                  {item.userName} · {ACTION_LABEL[item.actionType] ?? item.actionType}
                </p>
                <p className="mt-1 text-sm text-slate-700">{item.entityName}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {item.departmentName ?? "공통"} · {dayjs(item.createdAt).format("MM-DD HH:mm")}
                </p>
              </Link>
              {item.canDelete ? (
                <button
                  type="button"
                  className="shrink-0 self-start rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                  disabled={deleteActivity.isPending}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (
                      !window.confirm("이 활동 기록을 삭제할까요? 삭제 후에는 되돌릴 수 없습니다.")
                    ) {
                      return;
                    }
                    void deleteActivity.mutate(item.id, {
                      onError: (err) => {
                        window.alert(err instanceof Error ? err.message : "삭제에 실패했습니다.");
                      }
                    });
                  }}
                >
                  삭제
                </button>
              ) : null}
            </div>
          ))}
          {feedQuery.isLoading && <p className="text-sm text-slate-500">불러오는 중…</p>}
          {feedQuery.isError && (
            <p className="text-sm text-red-600">{(feedQuery.error as Error).message}</p>
          )}
          <div ref={sentinelRef} className="h-6" />
          {feedQuery.isFetchingNextPage && <p className="text-sm text-slate-500">추가 로드 중…</p>}
        </div>
      </section>

      <aside className="card-brand rounded-2xl p-5">
        <h3 className="text-base font-semibold text-slate-900">온라인 팀원</h3>
        <div className="mt-3 space-y-2">
          {onlineUsers.map((u) => (
            <div key={u.id} className="rounded-lg border border-emerald-100 bg-emerald-50/70 px-3 py-2">
              <p className="text-sm font-medium text-slate-900">{u.name}</p>
              <p className="text-xs text-slate-500">{u.departmentName ?? "부서 미지정"}</p>
            </div>
          ))}
          {onlineUsers.length === 0 && (
            <p className="text-sm text-slate-500">현재 표시할 온라인 팀원이 없습니다.</p>
          )}
        </div>
      </aside>
    </div>
  );
}
