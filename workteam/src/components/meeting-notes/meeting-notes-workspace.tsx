"use client";

import clsx from "clsx";
import { closestCenter, DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { markNavBadgeRead } from "@/lib/nav-badge-read";
import { AttachmentList } from "@/components/files/attachment-list";
import type { FileAttachmentDTO } from "@/types/files";
import type {
  ChecklistItem,
  MeetingNoteDetailDTO,
  MeetingNoteListItemDTO,
  NoteBlockDTO
} from "@/types/meeting-notes";

type Dept = { id: string; name: string };
type UserOpt = {
  id: string;
  name: string;
  email: string;
  departmentId?: string | null;
  departmentName?: string | null;
  departmentPath?: string | null;
};
type MentionOpen = {
  blockId: string;
  start: number;
  end: number;
  query: string;
};

function SortableNoteItem({
  note,
  active,
  onSelect
}: {
  note: MeetingNoteListItemDTO;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: note.id
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <button
      ref={setNodeRef}
      style={style}
      type="button"
      onClick={() => onSelect(note.id)}
      className={clsx(
        "mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs transition",
        active
          ? "bg-white font-semibold shadow-sm ring-1 ring-slate-200"
          : "text-slate-700 hover:bg-white/80",
        isDragging && "opacity-70"
      )}
      {...attributes}
      {...listeners}
    >
      <span className="shrink-0 text-[11px] text-slate-400">⋮⋮</span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block">{note.title || "제목 없음"}</span>
        <span className="mt-0.5 block text-[10px] text-slate-400">{note.departmentName}</span>
      </span>
    </button>
  );
}

function newBlock(t: NoteBlockDTO["type"]): NoteBlockDTO {
  const id = crypto.randomUUID();
  if (t === "divider") {
    return { id, type: "divider", body: null, checklistItems: null, sortOrder: 0 };
  }
  if (t === "checklist") {
    return {
      id,
      type: "checklist",
      body: null,
      checklistItems: [{ id: crypto.randomUUID(), text: "", checked: false }],
      sortOrder: 0
    };
  }
  if (t === "heading") {
    return { id, type: "heading", body: "", checklistItems: null, sortOrder: 0 };
  }
  return { id, type: "paragraph", body: "", checklistItems: null, sortOrder: 0 };
}

export function MeetingNotesWorkspace() {
  const [notes, setNotes] = useState<MeetingNoteListItemDTO[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MeetingNoteDetailDTO | null>(null);
  const [title, setTitle] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [blocks, setBlocks] = useState<NoteBlockDTO[]>([]);
  const [attendeeIds, setAttendeeIds] = useState<Set<string>>(new Set());
  const [attendeeQuery, setAttendeeQuery] = useState("");
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [myDepartmentId, setMyDepartmentId] = useState<string | null>(null);
  const [userQuery, setUserQuery] = useState("");
  const [mentionOpen, setMentionOpen] = useState<MentionOpen | null>(null);
  const [files, setFiles] = useState<FileAttachmentDTO[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const loadList = useCallback(async () => {
    const data = await fetchJson<{ notes: MeetingNoteListItemDTO[] }>("/api/meeting-notes");
    setNotes(data.notes);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const [d, u, me] = await Promise.all([
          fetchJson<{ departments: Dept[] }>("/api/departments"),
          fetchJson<{ users: UserOpt[] }>("/api/users"),
          fetchJson<{ user: { departmentId: string | null } }>("/api/chat/me")
        ]);
        setDepartments(d.departments);
        setUsers(u.users);
        setMyDepartmentId(me.user.departmentId);
      } catch {
        void 0;
      }
    })();
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const el = e.target;
      if (!(el instanceof Element)) return;
      if (el.closest("[data-mention-dropdown]") || el.closest("[data-note-editor]")) {
        return;
      }
      setMentionOpen(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filteredUsers = useMemo(() => {
    const q = (mentionOpen?.query || userQuery).trim().toLowerCase();
    if (!q) {
      return users.slice(0, 12);
    }
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q)
    ).slice(0, 12);
  }, [users, userQuery, mentionOpen?.query]);

  const attendeeCandidates = useMemo(() => {
    const q = attendeeQuery.trim().toLowerCase();
    const base = q.length === 0 && myDepartmentId ? users.filter((u) => u.departmentId === myDepartmentId) : users;
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
  }, [attendeeQuery, myDepartmentId, users]);

  const loadDetail = useCallback(async (id: string) => {
    setBusy(true);
    setErr(null);
    try {
      const data = await fetchJson<{ note: MeetingNoteDetailDTO }>(
        `/api/meeting-notes/${encodeURIComponent(id)}`
      );
      const n = data.note;
      setDetail(n);
      setTitle(n.title);
      setDepartmentId(n.departmentId);
      setBlocks(n.blocks.length > 0 ? n.blocks : [newBlock("paragraph")]);
      setAttendeeIds(new Set(n.attendeeUserIds));
      setAttendeeQuery("");
      const f = await fetchJson<{ attachments: FileAttachmentDTO[] }>(
        `/api/files?entityType=meeting_note&entityId=${encodeURIComponent(id)}`
      );
      setFiles(f.attachments);
      void markNavBadgeRead("notes").catch(() => void 0);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "불러오지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) {
      void loadDetail(selectedId);
    } else {
      setDetail(null);
    }
  }, [selectedId, loadDetail]);

  useEffect(() => {
    if (!departmentId && departments[0]) {
      setDepartmentId(departments[0].id);
    }
  }, [departments, departmentId]);

  async function save() {
    if (!selectedId) {
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const payload = {
        title,
        attendeeUserIds: Array.from(attendeeIds),
        blocks: blocks.map((b, i) => {
          if (b.type === "divider") {
            return { type: "divider" as const };
          }
          if (b.type === "checklist") {
            return {
              type: "checklist" as const,
              items: (b.checklistItems ?? []).map((it) => ({
                id: it.id,
                text: it.text,
                checked: it.checked
              }))
            };
          }
          if (b.type === "heading") {
            return { type: "heading" as const, body: b.body ?? "" };
          }
          return { type: "paragraph" as const, body: b.body ?? "" };
        })
      };
      await fetchJson(`/api/meeting-notes/${encodeURIComponent(selectedId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      await loadList();
      await loadDetail(selectedId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function createNote() {
    if (!departmentId && departments[0]) {
      setDepartmentId(departments[0].id);
    }
    const did = departmentId || departments[0]?.id;
    if (!did) {
      setErr("부서를 선택해 주세요.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetchJson<{ id: string }>("/api/meeting-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "새 미팅 노트",
          departmentId: did,
          attendeeUserIds: [],
          blocks: [{ type: "paragraph" as const, body: "" }]
        })
      });
      await loadList();
      setSelectedId(res.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "생성에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteNote() {
    if (!selectedId || !window.confirm("노트를 삭제할까요?")) {
      return;
    }
    try {
      await fetchJson(`/api/meeting-notes/${encodeURIComponent(selectedId)}`, {
        method: "DELETE"
      });
      setSelectedId(null);
      await loadList();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "삭제에 실패했습니다.");
    }
  }

  async function uploadFile(file: File) {
    if (!selectedId) {
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("entityType", "meeting_note");
    fd.append("entityId", selectedId);
    const res = await fetch("/api/files", { method: "POST", body: fd, credentials: "include" });
    if (res.ok) {
      const f = await fetchJson<{ attachments: FileAttachmentDTO[] }>(
        `/api/files?entityType=meeting_note&entityId=${encodeURIComponent(selectedId)}`
      );
      setFiles(f.attachments);
    }
  }

  function insertMention(blockId: string, uid: string, uname: string) {
    const open = mentionOpen;
    if (!open || open.blockId !== blockId) {
      return;
    }
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId || (b.type !== "paragraph" && b.type !== "heading")) {
          return b;
        }
        const tag = `@[${uid}:${uname}] `;
        const base = b.body ?? "";
        const next = `${base.slice(0, open.start)}${tag}${base.slice(open.end)}`;
        return { ...b, body: next };
      })
    );
    setUserQuery("");
    setMentionOpen(null);
  }

  async function saveNoteOrder(next: MeetingNoteListItemDTO[]) {
    if (next.length === 0) return;
    try {
      await fetchJson("/api/meeting-notes/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedNoteIds: next.map((n) => n.id) })
      });
    } catch {
      void 0;
    }
  }

  function onNotesDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    setNotes((prev) => {
      const oldIndex = prev.findIndex((n) => n.id === active.id);
      const newIndex = prev.findIndex((n) => n.id === over.id);
      if (oldIndex < 0 || newIndex < 0) {
        return prev;
      }
      const next = arrayMove(prev, oldIndex, newIndex);
      void saveNoteOrder(next);
      return next;
    });
  }

  function renderBodyText(body: string) {
    const parts = body.split(/(\@\[[^:]+:[^\]]+\])/g);
    return parts.map((part, i) => {
      const m = /^\@\[([^:]+):([^\]]+)\]$/.exec(part);
      if (m) {
        return (
          <span key={i} className="rounded bg-brand-100 px-1 text-brand-900">
            @{m[2]}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  }

  return (
    <div className="card-brand flex min-h-[calc(100vh-160px)] gap-0 overflow-hidden rounded-2xl">
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-[#fbfbfa]">
        <div className="border-b border-slate-200 p-3">
          <button
            type="button"
            onClick={() => void createNote()}
            disabled={busy || departments.length === 0}
            className="w-full rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            + 새 노트
          </button>
          {departments.length > 0 ? (
            <label className="mt-2 block text-[10px] font-semibold uppercase text-slate-500">
              기본 부서
              <select
                className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onNotesDragEnd}>
            <SortableContext items={notes.map((n) => n.id)} strategy={rectSortingStrategy}>
              {notes.map((n) => (
                <SortableNoteItem
                  key={n.id}
                  note={n}
                  active={n.id === selectedId}
                  onSelect={setSelectedId}
                />
              ))}
            </SortableContext>
          </DndContext>
          {notes.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-slate-500">노트가 없습니다.</p>
          ) : null}
        </nav>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col bg-white">
        {selectedId && detail ? (
          <>
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-8 py-4">
              <input
                className="max-w-xl flex-1 border-0 bg-transparent text-xl font-bold text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-0"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="제목"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={busy}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  저장
                </button>
                <button
                  type="button"
                  onClick={() => void deleteNote()}
                  className="rounded-lg border border-rose-200 px-3 py-2 text-xs text-rose-700 hover:bg-rose-50"
                >
                  삭제
                </button>
              </div>
            </header>
            <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-8 py-6">
              {err ? (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</p>
              ) : null}

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">참석자</p>
                {attendeeIds.size > 0 ? (
                  <div className="mb-2 flex flex-wrap gap-1">
                    {Array.from(attendeeIds).map((id) => {
                      const user = users.find((u) => u.id === id);
                      if (!user) return null;
                      const path = user.departmentPath || user.departmentName || "미지정 조직";
                      return (
                        <span key={id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                          {path}  {user.name}
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
                  value={attendeeQuery}
                  onChange={(e) => setAttendeeQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500/20 focus:ring-2"
                  placeholder="이름/이메일/조직 검색"
                />
                <div className="mt-2 max-h-36 overflow-y-auto rounded-lg border border-slate-200">
                  {attendeeCandidates.map((u) => {
                    const path = u.departmentPath || u.departmentName || "미지정 조직";
                    return (
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
                        <span className="truncate">{path}  {u.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  미팅 노트
                </p>
                <div className="space-y-3">
                  {blocks.map((b, bi) => (
                    <div key={b.id} className="group relative rounded-lg border border-transparent px-1 py-0.5 hover:border-slate-100 hover:bg-slate-50/50">
                      {b.type === "divider" ? (
                        <hr className="my-3 border-slate-200" />
                      ) : null}
                      {b.type === "heading" ? (
                        <input
                          className="w-full border-0 bg-transparent text-lg font-semibold text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-0"
                          value={b.body ?? ""}
                          placeholder="제목 블록"
                          onChange={(e) => {
                            const v = e.target.value;
                            setBlocks((p) =>
                              p.map((x) =>
                                x.id === b.id && x.type === "heading"
                                  ? { ...x, body: v }
                                  : x
                              )
                            );
                          }}
                        />
                      ) : null}
                      {b.type === "paragraph" ? (
                        <>
                          <textarea
                            data-note-editor
                            className="w-full resize-y border-0 bg-transparent text-sm leading-relaxed text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-0"
                            rows={3}
                            value={b.body ?? ""}
                            placeholder="본문 (@ 로 멘션)"
                            onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                setMentionOpen(null);
                              }
                            }}
                            onChange={(e) => {
                              const v = e.target.value;
                              const cursor = e.target.selectionStart ?? v.length;
                              const before = v.slice(0, cursor);
                              const m = /(^|\s)@([^\s@]*)$/.exec(before);
                              if (m) {
                                const start = cursor - m[2].length - 1;
                                setUserQuery(m[2]);
                                setMentionOpen({ blockId: b.id, start, end: cursor, query: m[2] });
                              } else if (mentionOpen?.blockId === b.id) {
                                setMentionOpen(null);
                              }
                              setBlocks((p) =>
                                p.map((x) =>
                                  x.id === b.id && x.type === "paragraph"
                                    ? { ...x, body: v }
                                    : x
                                )
                              );
                            }}
                          />
                          {mentionOpen?.blockId === b.id ? (
                            <div data-mention-dropdown className="absolute left-0 top-full z-20 mt-1 max-h-44 w-64 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                              <div className="flex items-center border-b border-slate-100 px-2 py-1">
                                <input
                                  className="min-w-0 flex-1 text-xs outline-none"
                                  placeholder="이름 검색"
                                  value={userQuery}
                                  onChange={(e) => {
                                    setUserQuery(e.target.value);
                                    setMentionOpen((prev) =>
                                      prev ? { ...prev, query: e.target.value } : prev
                                    );
                                  }}
                                />
                                <button
                                  type="button"
                                  className="rounded px-1 text-xs text-slate-500 hover:bg-slate-100"
                                  onClick={() => setMentionOpen(null)}
                                >
                                  닫기
                                </button>
                              </div>
                              {filteredUsers.map((u) => (
                                <button
                                  key={u.id}
                                  type="button"
                                  className="flex w-full px-2 py-1.5 text-left text-xs hover:bg-slate-50"
                                  onClick={() => insertMention(b.id, u.id, u.name)}
                                >
                                  {u.name}
                                </button>
                              ))}
                            </div>
                          ) : null}
                          {b.body ? (
                            <p className="mt-1 text-xs text-slate-400">미리보기</p>
                          ) : null}
                          {b.body ? (
                            <div className="mt-1 rounded border border-slate-100 bg-white/80 px-2 py-1 text-sm">
                              {renderBodyText(b.body)}
                            </div>
                          ) : null}
                        </>
                      ) : null}
                      {b.type === "checklist" ? (
                        <div className="space-y-2">
                          {(b.checklistItems ?? []).map((item, ci) => (
                            <div key={item.id} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={item.checked}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setBlocks((p) =>
                                    p.map((bl) => {
                                      if (bl.id !== b.id || bl.type !== "checklist") {
                                        return bl;
                                      }
                                      const items = [...(bl.checklistItems ?? [])];
                                      items[ci] = { ...items[ci]!, checked };
                                      return { ...bl, checklistItems: items };
                                    })
                                  );
                                }}
                              />
                              <input
                                className="min-w-0 flex-1 border-0 border-b border-transparent bg-transparent text-sm focus:border-slate-200 focus:outline-none"
                                value={item.text}
                                placeholder="액션 아이템"
                                onChange={(e) => {
                                  const t = e.target.value;
                                  setBlocks((p) =>
                                    p.map((bl) => {
                                      if (bl.id !== b.id || bl.type !== "checklist") {
                                        return bl;
                                      }
                                      const items = [...(bl.checklistItems ?? [])];
                                      items[ci] = { ...items[ci]!, text: t };
                                      return { ...bl, checklistItems: items };
                                    })
                                  );
                                }}
                              />
                            </div>
                          ))}
                          <button
                            type="button"
                            className="text-xs text-brand-600 hover:underline"
                            onClick={() =>
                              setBlocks((p) =>
                                p.map((bl) => {
                                  if (bl.id !== b.id || bl.type !== "checklist") {
                                    return bl;
                                  }
                                  return {
                                    ...bl,
                                    checklistItems: [
                                      ...(bl.checklistItems ?? []),
                                      {
                                        id: crypto.randomUUID(),
                                        text: "",
                                        checked: false
                                      }
                                    ]
                                  };
                                })
                              )
                            }
                          >
                            + 항목 추가
                          </button>
                        </div>
                      ) : null}
                      <div className="absolute -right-1 top-0 flex gap-1 opacity-0 transition group-hover:opacity-100">
                        <button
                          type="button"
                          className="rounded px-1 text-[10px] text-rose-500 hover:bg-rose-50"
                          onClick={() =>
                            setBlocks((p) => p.filter((x) => x.id !== b.id))
                          }
                          title="블록 삭제"
                        >
                          🗑
                        </button>
                        <button
                          type="button"
                          className="rounded px-1 text-[10px] text-slate-400 hover:bg-slate-200"
                          onClick={() =>
                            setBlocks((p) => {
                              const next = [...p];
                              next.splice(bi + 1, 0, newBlock("paragraph"));
                              return next;
                            })
                          }
                        >
                          +블록
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="text-[10px] font-semibold text-slate-400">블록 추가:</span>
                  {(
                    [
                      ["heading", "제목"],
                      ["paragraph", "본문"],
                      ["checklist", "체크리스트"],
                      ["divider", "구분선"]
                    ] as const
                  ).map(([t, lab]) => (
                    <button
                      key={t}
                      type="button"
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
                      onClick={() => setBlocks((p) => [...p, newBlock(t)])}
                    >
                      {lab}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  첨부 파일
                </p>
                <AttachmentList attachments={files} />
                <label className="mt-2 inline-flex cursor-pointer rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-600 hover:bg-slate-100">
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.docx,.xlsx,.pptx,.jpg,.jpeg,.png,.zip"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) {
                        void uploadFile(f);
                      }
                    }}
                  />
                  파일 업로드
                </label>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-12 text-center text-sm text-slate-500">
            왼쪽에서 노트를 선택하거나 새 노트를 만드세요.
          </div>
        )}
      </section>
    </div>
  );
}
