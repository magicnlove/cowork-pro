"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";

type QuickAddTab = "task" | "event" | "note" | "chat";

type Me = {
  id: string;
  name: string;
  role: string;
  departmentId: string | null;
  departmentName: string | null;
};

type UserOption = {
  id: string;
  name: string;
  email: string;
  departmentId?: string | null;
  departmentName?: string | null;
  departmentPath?: string | null;
};

type ChannelOption = {
  id: string;
  displayName: string;
  kind: "dm" | "company_wide" | "department" | "cross_team" | "group_dm";
};

type Props = {
  open: boolean;
  onClose: () => void;
};

const tabs: Array<{ id: QuickAddTab; label: string }> = [
  { id: "task", label: "태스크" },
  { id: "event", label: "일정" },
  { id: "note", label: "미팅노트" },
  { id: "chat", label: "채팅 메시지" }
];

function toLocalDateTimeValue(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

function addHours(localValue: string, hours: number) {
  const date = new Date(localValue);
  date.setHours(date.getHours() + hours);
  return toLocalDateTimeValue(date);
}

function formatOrgUserLabel(user: UserOption) {
  const org = user.departmentPath || user.departmentName || "미지정";
  return `${org} ${user.name}`;
}

export function QuickAddModal({ open, onClose }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<QuickAddTab>("task");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [me, setMe] = useState<Me | null>(null);
  const [userQuery, setUserQuery] = useState("");
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [channels, setChannels] = useState<ChannelOption[]>([]);

  const [taskTitle, setTaskTitle] = useState("");
  const [taskAssigneeId, setTaskAssigneeId] = useState<string>("");
  const [taskPriority, setTaskPriority] = useState<"high" | "medium" | "low">("medium");
  const [taskDueDate, setTaskDueDate] = useState("");

  const [eventTitle, setEventTitle] = useState("");
  const [eventKind, setEventKind] = useState<"personal" | "team" | "announcement">("personal");
  const [eventStart, setEventStart] = useState(toLocalDateTimeValue());
  const [eventEnd, setEventEnd] = useState(addHours(toLocalDateTimeValue(), 1));

  const [noteTitle, setNoteTitle] = useState("");

  const [chatChannelId, setChatChannelId] = useState("");
  const [chatBody, setChatBody] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const [meData, channelData] = await Promise.all([
          fetchJson<{ user: Me }>("/api/chat/me"),
          fetchJson<{ channels: Array<{ id: string; displayName: string; kind: ChannelOption["kind"] }> }>(
            "/api/chat/channels"
          )
        ]);
        if (cancelled) return;
        setMe(meData.user);
        setChannels(channelData.channels);
        setChatChannelId((prev) => prev || channelData.channels[0]?.id || "");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "초기 데이터를 불러오지 못했습니다.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !me) return;
    const handle = window.setTimeout(() => {
      void (async () => {
        try {
          const params = new URLSearchParams();
          if (userQuery.trim()) {
            params.set("q", userQuery.trim());
          } else if (me.departmentId) {
            params.set("departmentId", me.departmentId);
          }
          const data = await fetchJson<{ users: UserOption[] }>(`/api/users?${params.toString()}`);
          setUserOptions(data.users);
        } catch {
          void 0;
        }
      })();
    }, 250);
    return () => window.clearTimeout(handle);
  }, [open, me, userQuery]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const selectedChannelName = useMemo(
    () => channels.find((channel) => channel.id === chatChannelId)?.displayName ?? "",
    [channels, chatChannelId]
  );

  async function submitTask() {
    const res = await fetchJson<{ task: { id: string } }>("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: taskTitle.trim(),
        assigneeUserId: taskAssigneeId || null,
        priority: taskPriority,
        dueDate: taskDueDate || null
      })
    });
    onClose();
    router.push("/tasks");
    router.refresh();
    return res;
  }

  async function submitEvent() {
    const startsAt = new Date(eventStart).toISOString();
    const endsAt = new Date(eventEnd).toISOString();
    await fetchJson("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: eventTitle.trim(),
        startsAt,
        endsAt,
        kind: eventKind,
        departmentId: eventKind === "team" ? me?.departmentId ?? null : null,
        attendeeUserIds: []
      })
    });
    onClose();
    router.push("/calendar");
    router.refresh();
  }

  async function submitNote() {
    const res = await fetchJson<{ id: string }>("/api/meeting-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: noteTitle.trim(),
        departmentId: me?.departmentId,
        attendeeUserIds: [],
        blocks: []
      })
    });
    onClose();
    router.push(`/meeting-notes?id=${encodeURIComponent(res.id)}`);
    router.refresh();
  }

  async function submitChat() {
    const fd = new FormData();
    fd.append("channelId", chatChannelId);
    fd.append("body", chatBody.trim());
    await fetchJson("/api/chat/messages", {
      method: "POST",
      body: fd
    });
    onClose();
    router.push(`/chat?channelId=${encodeURIComponent(chatChannelId)}`);
    router.refresh();
  }

  async function handleSubmit() {
    setError(null);
    if (busy) return;
    try {
      setBusy(true);
      if (tab === "task") {
        if (!taskTitle.trim()) throw new Error("태스크 제목을 입력하세요.");
        await submitTask();
      } else if (tab === "event") {
        if (!eventTitle.trim()) throw new Error("일정 제목을 입력하세요.");
        if (eventKind === "team" && !me?.departmentId) throw new Error("팀 일정에 사용할 기본 부서가 없습니다.");
        await submitEvent();
      } else if (tab === "note") {
        if (!noteTitle.trim()) throw new Error("미팅노트 제목을 입력하세요.");
        if (!me?.departmentId) throw new Error("미팅노트를 만들 기본 부서가 없습니다.");
        await submitNote();
      } else {
        if (!chatChannelId) throw new Error("채널을 선택하세요.");
        if (!chatBody.trim()) throw new Error("메시지를 입력하세요.");
        await submitChat();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/35 px-4 py-12" role="dialog" aria-modal="true">
      <div className="card-brand w-full max-w-2xl overflow-hidden rounded-2xl shadow-2xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">빠른추가</h2>
              <p className="mt-1 text-sm text-slate-500">자주 만드는 항목을 여기서 바로 추가할 수 있습니다.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              닫기
            </button>
          </div>
          <div className="mt-4 flex gap-2">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  tab === item.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4 px-5 py-5">
          {tab === "task" ? (
            <>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">제목</span>
                <input
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-400"
                  placeholder="할 일을 입력하세요"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">담당자</span>
                <input
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  className="mb-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-400"
                  placeholder="이름이나 조직명으로 검색"
                />
                <div className="max-h-48 overflow-auto rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setTaskAssigneeId("")}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                      taskAssigneeId === "" ? "bg-brand-50 text-brand-700" : ""
                    }`}
                  >
                    <span>미지정</span>
                  </button>
                  {userOptions.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => setTaskAssigneeId(user.id)}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                        taskAssigneeId === user.id ? "bg-brand-50 text-brand-700" : ""
                      }`}
                    >
                      <span>{formatOrgUserLabel(user)}</span>
                    </button>
                  ))}
                </div>
              </label>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">우선순위</span>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as "high" | "medium" | "low")}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-400"
                  >
                    <option value="high">높음</option>
                    <option value="medium">보통</option>
                    <option value="low">낮음</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">마감일</span>
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-400"
                  />
                </label>
              </div>
            </>
          ) : null}

          {tab === "event" ? (
            <>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">제목</span>
                <input
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-400"
                  placeholder="일정 제목을 입력하세요"
                />
              </label>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">시작</span>
                  <input
                    type="datetime-local"
                    value={eventStart}
                    onChange={(e) => setEventStart(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-400"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">종료</span>
                  <input
                    type="datetime-local"
                    value={eventEnd}
                    onChange={(e) => setEventEnd(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-400"
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">구분</span>
                <select
                  value={eventKind}
                  onChange={(e) => setEventKind(e.target.value as "personal" | "team" | "announcement")}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-400"
                >
                  <option value="personal">개인</option>
                  <option value="team">팀</option>
                  <option value="announcement">공지</option>
                </select>
              </label>
              {eventKind === "team" ? (
                <p className="text-xs text-slate-500">팀 일정은 기본 소속 부서인 `{me?.departmentName ?? "미지정"}` 으로 저장됩니다.</p>
              ) : null}
            </>
          ) : null}

          {tab === "note" ? (
            <>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">제목</span>
                <input
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-400"
                  placeholder="미팅노트 제목을 입력하세요"
                />
              </label>
              <p className="text-sm text-slate-500">저장 후 미팅노트 페이지로 이동해 바로 내용을 작성할 수 있습니다.</p>
            </>
          ) : null}

          {tab === "chat" ? (
            <>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">채널</span>
                <select
                  value={chatChannelId}
                  onChange={(e) => setChatChannelId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-400"
                >
                  {channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">메시지</span>
                <textarea
                  value={chatBody}
                  onChange={(e) => setChatBody(e.target.value)}
                  rows={5}
                  className="w-full resize-none rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-400"
                  placeholder="보낼 메시지를 입력하세요"
                />
              </label>
              {selectedChannelName ? <p className="text-xs text-slate-500">저장 시 `{selectedChannelName}` 채널로 바로 전송됩니다.</p> : null}
            </>
          ) : null}

          {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            취소
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleSubmit()}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

