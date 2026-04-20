"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import dayjs from "dayjs";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { TasksKanban } from "@/components/tasks/tasks-kanban";
import { fetchJson } from "@/lib/fetch-json";
import { markTaskRead } from "@/lib/nav-badge-read";
import type { FileAttachmentDTO } from "@/types/files";
import {
  PRIORITY_LABEL,
  TASK_STATUSES,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type UserOption
} from "@/types/tasks";

function sortTasks(a: Task, b: Task): number {
  const order = TASK_STATUSES.map((x) => x.id);
  const si = order.indexOf(a.status) - order.indexOf(b.status);
  if (si !== 0) return si;
  return a.position - b.position || a.createdAt.localeCompare(b.createdAt);
}

function statusLabel(s: TaskStatus) {
  return TASK_STATUSES.find((x) => x.id === s)?.label ?? s;
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
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        aria-label="닫기"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-2xl ring-1 ring-black/5">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[min(80vh,640px)] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

type TaskFormValues = {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  assigneeUserId: string;
  tags: string;
};

function emptyForm(): TaskFormValues {
  return {
    title: "",
    description: "",
    status: "backlog",
    priority: "medium",
    dueDate: "",
    assigneeUserId: "",
    tags: ""
  };
}

function taskToForm(t: Task): TaskFormValues {
  return {
    title: t.title,
    description: t.description ?? "",
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate ?? "",
    assigneeUserId: t.assigneeUserId ?? "",
    tags: t.tags.join(", ")
  };
}

function parseTags(s: string): string[] {
  return s
    .split(/[,，]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function formatOrgUserLabel(u: UserOption): string {
  const path = u.departmentPath || u.departmentName || "미지정 조직";
  return `${path}  ${u.name}`;
}

function UserSinglePicker({
  selectedId,
  onSelect,
  deptUsers,
  allUsers
}: {
  selectedId: string;
  onSelect: (id: string) => void;
  deptUsers: UserOption[];
  allUsers: UserOption[];
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const q = query.trim().toLowerCase();
  const candidates = useMemo(() => {
    const source = q ? allUsers : deptUsers;
    if (!q) {
      return source.slice(0, 60);
    }
    return source
      .filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.departmentPath ?? "").toLowerCase().includes(q) ||
          (u.departmentName ?? "").toLowerCase().includes(q)
      )
      .slice(0, 60);
  }, [q, allUsers, deptUsers]);
  const selected = allUsers.find((u) => u.id === selectedId);
  return (
    <div className="relative">
      <input
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-2"
        placeholder="이름/이메일/조직 검색"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
      />
      {selected ? (
        <p className="mt-1 text-xs text-slate-600">선택됨: {formatOrgUserLabel(selected)}</p>
      ) : null}
      {open ? (
        <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50"
            onClick={() => {
              onSelect("");
              setOpen(false);
            }}
          >
            미지정
          </button>
          {candidates.map((u) => (
            <label key={u.id} className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50">
              <input
                type="radio"
                checked={selectedId === u.id}
                onChange={() => {
                  onSelect(u.id);
                  setOpen(false);
                }}
              />
              <span className="truncate">{formatOrgUserLabel(u)}</span>
            </label>
          ))}
          <button
            type="button"
            className="block w-full border-t border-slate-100 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            닫기
          </button>
        </div>
      ) : null}
    </div>
  );
}

type CreateFieldErrors = Partial<{
  title: string;
  assigneeUserId: string;
  dueDate: string;
  tags: string;
}>;

function validateCreate(values: TaskFormValues): CreateFieldErrors {
  const errors: CreateFieldErrors = {};
  if (!values.title.trim()) {
    errors.title = "제목을 입력해 주세요.";
  }
  if (!values.assigneeUserId) {
    errors.assigneeUserId = "담당자를 선택해 주세요.";
  }
  if (!values.dueDate) {
    errors.dueDate = "마감일을 선택해 주세요.";
  }
  if (parseTags(values.tags).length === 0) {
    errors.tags = "태그를 한 개 이상 입력해 주세요.";
  }
  return errors;
}

export function TasksWorkspace() {
  const qc = useQueryClient();
  const [view, setView] = useState<"board" | "list">("board");
  const [createOpen, setCreateOpen] = useState(false);
  const [createModalKey, setCreateModalKey] = useState(0);
  const [detailTask, setDetailTask] = useState<Task | null>(null);

  const tasksQuery = useQuery({
    queryKey: ["tasks"],
    queryFn: () => fetchJson<{ tasks: Task[] }>("/api/tasks").then((r) => r.tasks)
  });

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => fetchJson<{ users: UserOption[] }>("/api/users").then((r) => r.users)
  });
  const meQuery = useQuery({
    queryKey: ["chat-me"],
    queryFn: () =>
      fetchJson<{ user: { departmentId: string | null } }>("/api/chat/me").then((r) => r.user)
  });

  const moveMutation = useMutation({
    mutationFn: async (p: { taskId: string; status: TaskStatus; index: number }) => {
      return fetchJson<{ task: Task }>(`/api/tasks/${p.taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moveTo: { status: p.status, index: p.index } })
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] })
  });

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      return fetchJson<{ task: Task }>("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
    },
    onSuccess: (data) => {
      qc.setQueryData<Task[]>(["tasks"], (prev) => {
        const next = [...(prev ?? []), data.task];
        next.sort(sortTasks);
        return next;
      });
      void qc.invalidateQueries({ queryKey: ["tasks"] });
      setCreateOpen(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (p: { id: string; body: Record<string, unknown> }) => {
      return fetchJson<{ task: Task }>(`/api/tasks/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p.body)
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setDetailTask(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetchJson(`/api/tasks/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setDetailTask(null);
    }
  });

  useEffect(() => {
    if (!detailTask?.id) {
      return;
    }
    void markTaskRead(detailTask.id)
      .then(() => {
        void qc.invalidateQueries({ queryKey: ["tasks"] });
      })
      .catch(() => void 0);
  }, [detailTask?.id, qc]);

  const tasks = tasksQuery.data ?? [];
  const allUsers = usersQuery.data ?? [];
  const deptUsers = useMemo(() => {
    const did = meQuery.data?.departmentId;
    if (!did) {
      return allUsers;
    }
    return allUsers.filter((u) => u.departmentId === did);
  }, [allUsers, meQuery.data?.departmentId]);
  const sortedList = useMemo(() => [...tasks].sort(sortTasks), [tasks]);

  async function handleMove(taskId: string, status: TaskStatus, index: number) {
    await moveMutation.mutateAsync({ taskId, status, index });
  }

  function openCreateModal() {
    createMutation.reset();
    setCreateModalKey((k) => k + 1);
    setCreateOpen(true);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          드래그 핸들(⋮⋮)로 카드를 옮기고, 본문을 클릭하면 상세를 엽니다.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
            <button
              type="button"
              onClick={() => setView("board")}
              className={clsx(
                "rounded-md px-3 py-1.5 text-sm font-medium transition",
                view === "board" ? "bg-slate-800 text-white shadow" : "text-slate-600 hover:bg-slate-50"
              )}
            >
              보드
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={clsx(
                "rounded-md px-3 py-1.5 text-sm font-medium transition",
                view === "list" ? "bg-slate-800 text-white shadow" : "text-slate-600 hover:bg-slate-50"
              )}
            >
              목록
            </button>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            새 태스크
          </button>
        </div>
      </div>

      {tasksQuery.isLoading && <p className="text-sm text-slate-500">불러오는 중…</p>}
      {tasksQuery.isError && (
        <p className="text-sm text-red-600">
          {(tasksQuery.error as Error).message || "목록을 불러오지 못했습니다."}
        </p>
      )}

      {!tasksQuery.isLoading && view === "board" && (
        <TasksKanban tasks={tasks} onMove={handleMove} onCardClick={setDetailTask} />
      )}

      {!tasksQuery.isLoading && view === "list" && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead className="bg-[#f4f5f7] text-sm font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3">제목</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">담당자</th>
                <th className="px-4 py-3">우선순위</th>
                <th className="px-4 py-3">마감</th>
                <th className="px-4 py-3">태그</th>
              </tr>
            </thead>
            <tbody>
              {sortedList.map((t) => (
                <tr
                  key={t.id}
                  className="cursor-pointer border-t border-slate-100 hover:bg-brand-50/40"
                  onClick={() => setDetailTask(t)}
                >
                  <td className="max-w-[280px] px-4 py-2.5 font-medium text-slate-900">
                    <div className="flex items-start gap-2">
                      <span className="line-clamp-2">{t.title}</span>
                      {t.isNew ? (
                        <span className="shrink-0 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-rose-800">
                          New
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">{statusLabel(t.status)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">{t.assigneeName ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <span
                      className={clsx(
                        "rounded px-2 py-0.5 text-xs font-medium",
                        t.priority === "high" && "bg-red-50 text-red-700",
                        t.priority === "medium" && "bg-amber-50 text-amber-800",
                        t.priority === "low" && "bg-emerald-50 text-emerald-800"
                      )}
                    >
                      {PRIORITY_LABEL[t.priority]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                    {t.dueDate ? dayjs(t.dueDate).format("YYYY-MM-DD") : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    <div className="flex flex-wrap gap-1">
                      {t.tags.length === 0 && "—"}
                      {t.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sortedList.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-slate-500">태스크가 없습니다.</p>
          )}
        </div>
      )}

      {createOpen && (
        <TaskCreateModal
          key={createModalKey}
          users={allUsers}
          deptUsers={deptUsers}
          isSubmitting={createMutation.isPending}
          apiError={createMutation.error as Error | null}
          onClose={() => {
            setCreateOpen(false);
            createMutation.reset();
          }}
          onSubmit={(values) => {
            const errs = validateCreate(values);
            if (Object.keys(errs).length > 0) {
              return { fieldErrors: errs };
            }
            createMutation.mutate({
              title: values.title.trim(),
              description: null,
              status: "backlog",
              priority: values.priority,
              dueDate: values.dueDate || null,
              assigneeUserId: values.assigneeUserId || null,
              tags: parseTags(values.tags)
            });
            return { fieldErrors: null };
          }}
        />
      )}

      {detailTask && (
        <TaskFormModal
          key={detailTask.id}
          taskId={detailTask.id}
          title="태스크 상세"
          initial={taskToForm(detailTask)}
          users={allUsers}
          deptUsers={deptUsers}
          submitLabel="저장"
          isSubmitting={updateMutation.isPending}
          error={updateMutation.error as Error | null}
          onClose={() => setDetailTask(null)}
          onSubmit={(values) => {
            updateMutation.mutate({
              id: detailTask.id,
              body: {
                title: values.title,
                description: values.description || null,
                status: values.status,
                priority: values.priority,
                dueDate: values.dueDate || null,
                assigneeUserId: values.assigneeUserId || null,
                tags: parseTags(values.tags)
              }
            });
          }}
          onDelete={() => {
            if (confirm("이 태스크를 삭제할까요?")) {
              deleteMutation.mutate(detailTask.id);
            }
          }}
          isDeleting={deleteMutation.isPending}
        />
      )}
    </div>
  );
}

function TaskCreateModal({
  users,
  deptUsers,
  isSubmitting,
  apiError,
  onClose,
  onSubmit
}: {
  users: UserOption[];
  deptUsers: UserOption[];
  isSubmitting: boolean;
  apiError: Error | null;
  onClose: () => void;
  onSubmit: (values: TaskFormValues) => { fieldErrors: CreateFieldErrors | null };
}) {
  const [values, setValues] = useState<TaskFormValues>(() => emptyForm());
  const [fieldErrors, setFieldErrors] = useState<CreateFieldErrors>({});

  function clearField<K extends keyof CreateFieldErrors>(key: K) {
    setFieldErrors((e) => {
      const next = { ...e };
      delete next[key];
      return next;
    });
  }

  return (
    <Modal title="새 태스크" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const result = onSubmit(values);
          if (result.fieldErrors) {
            setFieldErrors(result.fieldErrors);
            return;
          }
          setFieldErrors({});
        }}
      >
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">제목</span>
          <input
            className={clsx(
              "mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-2",
              fieldErrors.title ? "border-red-400 bg-red-50/50" : "border-slate-200"
            )}
            value={values.title}
            onChange={(e) => {
              setValues((v) => ({ ...v, title: e.target.value }));
              clearField("title");
            }}
            autoComplete="off"
          />
          {fieldErrors.title && <p className="mt-1 text-xs text-red-600">{fieldErrors.title}</p>}
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">담당자</span>
          <UserSinglePicker
            selectedId={values.assigneeUserId}
            onSelect={(id) => {
              setValues((v) => ({ ...v, assigneeUserId: id }));
              clearField("assigneeUserId");
            }}
            deptUsers={deptUsers}
            allUsers={users}
          />
          {fieldErrors.assigneeUserId && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.assigneeUserId}</p>
          )}
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">우선순위</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-2"
            value={values.priority}
            onChange={(e) =>
              setValues((v) => ({ ...v, priority: e.target.value as TaskPriority }))
            }
          >
            {(Object.keys(PRIORITY_LABEL) as TaskPriority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">마감일</span>
          <input
            type="date"
            className={clsx(
              "mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-2",
              fieldErrors.dueDate ? "border-red-400 bg-red-50/50" : "border-slate-200"
            )}
            value={values.dueDate}
            onChange={(e) => {
              setValues((v) => ({ ...v, dueDate: e.target.value }));
              clearField("dueDate");
            }}
          />
          {fieldErrors.dueDate && <p className="mt-1 text-xs text-red-600">{fieldErrors.dueDate}</p>}
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            태그 (쉼표로 구분)
          </span>
          <input
            className={clsx(
              "mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-2",
              fieldErrors.tags ? "border-red-400 bg-red-50/50" : "border-slate-200"
            )}
            placeholder="design, frontend"
            value={values.tags}
            onChange={(e) => {
              setValues((v) => ({ ...v, tags: e.target.value }));
              clearField("tags");
            }}
          />
          {fieldErrors.tags && <p className="mt-1 text-xs text-red-600">{fieldErrors.tags}</p>}
        </label>

        {apiError && <p className="text-sm text-red-600">{apiError.message}</p>}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {isSubmitting ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function TaskFormModal({
  taskId,
  title,
  initial,
  users,
  deptUsers,
  submitLabel,
  isSubmitting,
  error,
  onClose,
  onSubmit,
  onDelete,
  isDeleting
}: {
  taskId?: string;
  title: string;
  initial: TaskFormValues;
  users: UserOption[];
  deptUsers: UserOption[];
  submitLabel: string;
  isSubmitting: boolean;
  error: Error | null;
  onClose: () => void;
  onSubmit: (v: TaskFormValues) => void;
  onDelete?: () => void;
  isDeleting?: boolean;
}) {
  const qc = useQueryClient();
  const [values, setValues] = useState<TaskFormValues>(initial);

  const filesQuery = useQuery({
    queryKey: ["files", "task", taskId],
    enabled: Boolean(taskId),
    queryFn: () =>
      fetchJson<{ attachments: FileAttachmentDTO[] }>(
        `/api/files?entityType=task&entityId=${encodeURIComponent(taskId!)}`
      ).then((r) => r.attachments)
  });

  async function uploadAttachment(file: File) {
    if (!taskId) {
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("entityType", "task");
    fd.append("entityId", taskId);
    const res = await fetch("/api/files", { method: "POST", body: fd, credentials: "include" });
    if (res.status === 401) {
      window.location.assign("/");
      return;
    }
    if (!res.ok) {
      throw new Error("업로드에 실패했습니다.");
    }
    await qc.invalidateQueries({ queryKey: ["files", "task", taskId] });
  }

  async function removeAttachment(id: string) {
    if (!window.confirm("첨부를 삭제할까요?")) {
      return;
    }
    const res = await fetch(`/api/files/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include"
    });
    if (res.ok) {
      await qc.invalidateQueries({ queryKey: ["files", "task", taskId] });
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(values);
        }}
      >
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">제목</span>
          <input
            required
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-2"
            value={values.title}
            onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">설명</span>
          <textarea
            rows={3}
            className="mt-1 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-2"
            value={values.description}
            onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">상태</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-2"
              value={values.status}
              onChange={(e) =>
                setValues((v) => ({ ...v, status: e.target.value as TaskStatus }))
              }
            >
              {TASK_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">우선순위</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-2"
              value={values.priority}
              onChange={(e) =>
                setValues((v) => ({ ...v, priority: e.target.value as TaskPriority }))
              }
            >
              {(Object.keys(PRIORITY_LABEL) as TaskPriority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">마감일</span>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-2"
              value={values.dueDate}
              onChange={(e) => setValues((v) => ({ ...v, dueDate: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">담당자</span>
            <UserSinglePicker
              selectedId={values.assigneeUserId}
              onSelect={(id) => setValues((v) => ({ ...v, assigneeUserId: id }))}
              deptUsers={deptUsers}
              allUsers={users}
            />
          </label>
        </div>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            태그 (쉼표로 구분)
          </span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-2"
            placeholder="design, frontend"
            value={values.tags}
            onChange={(e) => setValues((v) => ({ ...v, tags: e.target.value }))}
          />
        </label>

        {taskId ? (
          <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">첨부 파일</p>
            {filesQuery.data && filesQuery.data.length > 0 ? (
              <div className="mt-2 space-y-1">
                {filesQuery.data.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 text-sm">
                    <a
                      href={a.url}
                      className="min-w-0 flex-1 truncate font-medium text-brand-700 hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {a.originalName}
                    </a>
                    <button
                      type="button"
                      className="shrink-0 text-xs text-rose-600 hover:underline"
                      onClick={() => void removeAttachment(a.id)}
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-xs text-slate-500">첨부된 파일이 없습니다.</p>
            )}
            <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
              <input
                type="file"
                className="hidden"
                accept=".pdf,.docx,.xlsx,.pptx,.jpg,.jpeg,.png,.zip"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) {
                    void uploadAttachment(f).catch(() => void 0);
                  }
                }}
              />
              + 파일 추가
            </label>
          </div>
        ) : null}

        {error && <p className="text-sm text-red-600">{error.message}</p>}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
          <div>
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                disabled={isDeleting}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                {isDeleting ? "삭제 중…" : "삭제"}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {isSubmitting ? "저장 중…" : submitLabel}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
