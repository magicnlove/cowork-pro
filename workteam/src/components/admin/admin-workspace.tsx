"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { parseUserImportWorkbook } from "@/lib/admin-excel-users";
import {
  DEFAULT_NAV_VISIBILITY,
  type NavMenuKey,
  type NavMenuVisibility
} from "@/lib/navigation-settings";
import { fetchJson } from "@/lib/fetch-json";

const NAV_MENU_ADMIN_ROWS: Array<{ key: NavMenuKey; label: string }> = [
  { key: "dashboard", label: "대시보드" },
  { key: "chat", label: "채팅" },
  { key: "tasks", label: "태스크/칸반" },
  { key: "calendar", label: "캘린더" },
  { key: "meeting_notes", label: "미팅노트" },
  { key: "activity_feed", label: "액티비티피드" },
  { key: "archive", label: "아카이브" }
];

type Dept = {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
  depth: number;
  sortOrder: number;
};

type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  departmentId: string | null;
  departmentName: string | null;
  departmentAssignments: Array<{
    departmentId: string;
    departmentName: string;
    role: "admin" | "manager" | "member";
    isPrimary: boolean;
  }>;
};

type PasswordResetRequestRow = {
  id: string;
  userId: string;
  status: string;
  createdAt: string;
  userEmail: string;
  userName: string;
};

type TempPasswordResult = {
  userEmail: string;
  tempPassword: string;
  emailSent: boolean;
};

function TempPasswordResultModal({
  data,
  copyDone,
  onCopy,
  onClose
}: {
  data: TempPasswordResult;
  copyDone: boolean;
  onCopy: () => void;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby="temp-pw-modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="card-brand w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="temp-pw-modal-title" className="text-lg font-semibold text-slate-900">
          임시 비밀번호 발급
        </h3>
        <p className="mt-1 text-sm text-slate-500">아래 내용을 확인하고, 필요 시 비밀번호를 복사해 전달해 주세요.</p>

        <dl className="mt-5 space-y-4 text-sm">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">이메일</dt>
            <dd className="mt-1 break-all font-medium text-slate-900">{data.userEmail}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">임시 비밀번호</dt>
            <dd className="mt-2 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-base text-slate-900">
                {data.tempPassword}
              </code>
              <button
                type="button"
                onClick={onCopy}
                className="shrink-0 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-800 hover:bg-brand-100"
              >
                {copyDone ? "복사됨!" : "복사"}
              </button>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">SMTP 이메일 발송</dt>
            <dd className="mt-1 text-slate-800">
              {data.emailSent ? (
                <span className="text-emerald-700">예 — 등록 이메일로 발송되었습니다.</span>
              ) : (
                <span className="text-amber-800">아니오 — 화면의 비밀번호를 구두로 전달해 주세요.</span>
              )}
            </dd>
          </div>
        </dl>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

type DepartmentAssignmentInput = {
  departmentId: string;
  role: "admin" | "manager" | "member";
  isPrimary: boolean;
};

function buildChildrenMap(depts: Dept[]) {
  const m = new Map<string | null, Dept[]>();
  for (const d of depts) {
    const k = d.parentId;
    if (!m.has(k)) {
      m.set(k, []);
    }
    m.get(k)!.push(d);
  }
  for (const arr of m.values()) {
    arr.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }
  return m;
}

function TreeNodes({
  parentId,
  depth,
  childrenMap,
  open,
  toggle,
  onDeleteDepartment,
  deletingDepartmentId
}: {
  parentId: string | null;
  depth: number;
  childrenMap: Map<string | null, Dept[]>;
  open: Set<string>;
  toggle: (id: string) => void;
  onDeleteDepartment: (dept: Dept, hasChildren: boolean) => void;
  deletingDepartmentId: string | null;
}) {
  const list = childrenMap.get(parentId) ?? [];
  return (
    <ul className={depth === 0 ? "" : "ml-4 border-l border-slate-200 pl-3"}>
      {list.map((d) => {
        const kids = childrenMap.get(d.id) ?? [];
        const hasKids = kids.length > 0;
        const isOpen = open.has(d.id);
        return (
          <li key={d.id} className="py-0.5 text-sm">
            <div className="flex items-center gap-2">
              {hasKids ? (
                <button
                  type="button"
                  className="w-5 text-xs text-slate-500"
                  onClick={() => toggle(d.id)}
                  aria-expanded={isOpen}
                >
                  {isOpen ? "▼" : "▶"}
                </button>
              ) : (
                <span className="w-5" />
              )}
              <span className="font-medium text-slate-800">{d.name}</span>
              <span className="text-xs text-slate-400">{d.code}</span>
              <button
                type="button"
                disabled={Boolean(deletingDepartmentId)}
                className="ml-1 rounded border border-rose-200 px-1.5 py-0.5 text-[11px] text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                onClick={() => onDeleteDepartment(d, hasKids)}
              >
                {deletingDepartmentId === d.id ? "삭제 중…" : "삭제"}
              </button>
            </div>
            {hasKids && isOpen ? (
              <TreeNodes
                parentId={d.id}
                depth={depth + 1}
                childrenMap={childrenMap}
                open={open}
                toggle={toggle}
                onDeleteDepartment={onDeleteDepartment}
                deletingDepartmentId={deletingDepartmentId}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function DepartmentAssignmentsEditor({
  departments,
  value,
  onChange
}: {
  departments: Dept[];
  value: DepartmentAssignmentInput[];
  onChange: (next: DepartmentAssignmentInput[]) => void;
}) {
  function patchAt(index: number, partial: Partial<DepartmentAssignmentInput>) {
    onChange(
      value.map((v, i) => {
        if (i !== index) return v;
        return { ...v, ...partial };
      })
    );
  }
  return (
    <div className="space-y-2">
      {value.map((a, i) => (
        <div key={`${a.departmentId}-${i}`} className="grid grid-cols-12 gap-2 rounded border border-slate-200 p-2">
          <select
            className="col-span-5 rounded border border-slate-200 px-2 py-1 text-xs"
            value={a.departmentId}
            onChange={(e) => patchAt(i, { departmentId: e.target.value })}
          >
            <option value="">부서 선택</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            className="col-span-3 rounded border border-slate-200 px-2 py-1 text-xs"
            value={a.role}
            onChange={(e) =>
              patchAt(i, { role: e.target.value as DepartmentAssignmentInput["role"] })
            }
          >
            <option value="member">member</option>
            <option value="manager">manager</option>
            <option value="admin">admin</option>
          </select>
          <label className="col-span-3 flex items-center gap-1 text-xs text-slate-600">
            <input
              type="radio"
              checked={a.isPrimary}
              onChange={() =>
                onChange(
                  value.map((row, idx) => ({
                    ...row,
                    isPrimary: idx === i
                  }))
                )
              }
            />
            주 소속
          </label>
          <button
            type="button"
            className="col-span-1 rounded border border-rose-200 text-xs text-rose-600"
            onClick={() => onChange(value.filter((_, idx) => idx !== i))}
          >
            x
          </button>
        </div>
      ))}
      <button
        type="button"
        className="rounded border border-slate-200 bg-white px-2 py-1 text-xs"
        onClick={() =>
          onChange([
            ...value,
            {
              departmentId: departments[0]?.id ?? "",
              role: "member",
              isPrimary: value.length === 0
            }
          ])
        }
      >
        + 부서 배정 추가
      </button>
    </div>
  );
}

type BulkPreviewRow = {
  rowIndex: number;
  email: string;
  name: string;
  role: string;
  departments: string;
  error: string | null;
};

export function AdminWorkspace() {
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filterName, setFilterName] = useState("");
  const [filterEmail, setFilterEmail] = useState("");
  const [filterRole, setFilterRole] = useState<"" | "admin" | "manager" | "member">("");
  const [filterDepartmentId, setFilterDepartmentId] = useState("");

  useEffect(() => {
    setFilterName(searchParams.get("name") ?? "");
    setFilterEmail(searchParams.get("email") ?? "");
    const r = searchParams.get("role") ?? "";
    setFilterRole(r === "admin" || r === "manager" || r === "member" ? r : "");
    setFilterDepartmentId(searchParams.get("departmentId") ?? "");
  }, [searchParams]);

  function applyUserFilters() {
    const sp = new URLSearchParams();
    if (filterName.trim()) {
      sp.set("name", filterName.trim());
    }
    if (filterEmail.trim()) {
      sp.set("email", filterEmail.trim());
    }
    if (filterRole) {
      sp.set("role", filterRole);
    }
    if (filterDepartmentId) {
      sp.set("departmentId", filterDepartmentId);
    }
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function resetUserFilters() {
    setFilterName("");
    setFilterEmail("");
    setFilterRole("");
    setFilterDepartmentId("");
    router.replace(pathname, { scroll: false });
  }

  const [bulkParsedRows, setBulkParsedRows] = useState<
    Array<{
      rowIndex: number;
      email: string;
      password: string;
      name: string;
      role: string;
      departments: string;
    }> | null
  >(null);
  const [bulkPreview, setBulkPreview] = useState<BulkPreviewRow[] | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    successCount: number;
    failCount: number;
    failures: Array<{ rowIndex: number; reason: string }>;
  } | null>(null);

  const meQuery = useQuery({
    queryKey: ["chat-me"],
    queryFn: () => fetchJson<{ user: { role: string } }>("/api/chat/me").then((r) => r.user)
  });
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [deptForm, setDeptForm] = useState({
    name: "",
    code: "",
    parentId: "" as string | "",
    sortOrder: 0
  });
  const [userForm, setUserForm] = useState({
    email: "",
    password: "",
    name: "",
    role: "member" as "admin" | "manager" | "member",
    departmentAssignments: [] as DepartmentAssignmentInput[]
  });
  const [deletingDepartmentId, setDeletingDepartmentId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [tempPasswordModal, setTempPasswordModal] = useState<TempPasswordResult | null>(null);
  const [passwordCopyDone, setPasswordCopyDone] = useState(false);

  const deptsQuery = useQuery({
    queryKey: ["admin-departments"],
    queryFn: () => fetchJson<{ departments: Dept[] }>("/api/admin/departments").then((r) => r.departments)
  });

  const usersQuery = useQuery({
    queryKey: ["admin-users", searchParams.toString()],
    queryFn: () => {
      const qs = searchParams.toString();
      const url = qs ? `/api/admin/users?${qs}` : "/api/admin/users";
      return fetchJson<{ users: AdminUser[] }>(url).then((r) => r.users);
    },
    enabled: Boolean(meQuery.data?.role === "admin")
  });

  const childrenMap = useMemo(() => buildChildrenMap(deptsQuery.data ?? []), [deptsQuery.data]);

  const createDept = useMutation({
    mutationFn: () =>
      fetchJson("/api/admin/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: deptForm.name.trim(),
          code: deptForm.code.trim(),
          parentId: deptForm.parentId || null,
          sortOrder: deptForm.sortOrder
        })
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-departments"] });
      qc.invalidateQueries({ queryKey: ["departments"] });
      setDeptForm({ name: "", code: "", parentId: "", sortOrder: 0 });
    }
  });

  const createUser = useMutation({
    mutationFn: () =>
      fetchJson("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userForm.email.trim(),
          password: userForm.password,
          name: userForm.name.trim(),
          role: userForm.role,
          departmentAssignments: userForm.departmentAssignments
        })
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["users"] });
      setUserForm({ email: "", password: "", name: "", role: "member", departmentAssignments: [] });
    }
  });

  const updateUser = useMutation({
    mutationFn: (p: { id: string; body: Record<string, unknown> }) =>
      fetchJson(`/api/admin/users/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p.body)
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["users"] });
    }
  });

  const deleteDepartment = useMutation({
    mutationFn: (deptId: string) =>
      fetchJson(`/api/admin/departments/${deptId}`, {
        method: "DELETE"
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-departments"] });
      qc.invalidateQueries({ queryKey: ["departments"] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    }
  });

  const deleteUser = useMutation({
    mutationFn: (userId: string) =>
      fetchJson(`/api/admin/users/${userId}`, {
        method: "DELETE"
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["users"] });
    }
  });

  const resetReqQuery = useQuery({
    queryKey: ["password-reset-requests"],
    queryFn: () =>
      fetchJson<{ requests: PasswordResetRequestRow[] }>("/api/admin/password-reset-requests").then(
        (r) => r.requests
      ),
    enabled: Boolean(meQuery.data?.role === "admin")
  });

  const approveReset = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/password-reset-requests/${id}/approve`, {
        method: "POST",
        credentials: "include"
      });
      const data = (await res.json()) as {
        message?: string;
        tempPassword?: string;
        emailSent?: boolean;
        userEmail?: string;
      };
      if (!res.ok) {
        throw new Error(data.message ?? "승인에 실패했습니다.");
      }
      return data;
    },
    onSuccess: (data) => {
      setPasswordCopyDone(false);
      setTempPasswordModal({
        userEmail: data.userEmail ?? "",
        tempPassword: data.tempPassword ?? "",
        emailSent: Boolean(data.emailSent)
      });
      qc.invalidateQueries({ queryKey: ["password-reset-requests"] });
    }
  });

  const rejectReset = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/password-reset-requests/${id}/reject`, {
        method: "POST",
        credentials: "include"
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        throw new Error(data.message ?? "거절에 실패했습니다.");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["password-reset-requests"] });
    }
  });

  const cleanupLogsQuery = useQuery({
    queryKey: ["admin-cleanup-logs"],
    queryFn: () =>
      fetchJson<{ logs: Array<{ id: string; runAt: string; filesDeleted: number }> }>("/api/admin/cleanup").then(
        (r) => r.logs
      ),
    enabled: Boolean(meQuery.data?.role === "admin")
  });

  const runCleanupNow = useMutation({
    mutationFn: () => fetchJson<{ filesDeleted: number }>("/api/admin/cleanup", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-cleanup-logs"] });
    }
  });

  const navSettingsQuery = useQuery({
    queryKey: ["navigation-settings"],
    queryFn: () =>
      fetchJson<{ visibility: typeof DEFAULT_NAV_VISIBILITY }>("/api/navigation-settings").then(
        (r) => r.visibility
      ),
    enabled: Boolean(meQuery.data?.role === "admin")
  });

  const [navDraft, setNavDraft] = useState<NavMenuVisibility | null>(null);
  useEffect(() => {
    if (navSettingsQuery.data) {
      setNavDraft({ ...navSettingsQuery.data });
    }
  }, [navSettingsQuery.data]);

  const patchNavSettings = useMutation({
    mutationFn: (body: NavMenuVisibility) =>
      fetchJson("/api/admin/navigation-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["navigation-settings"] });
    }
  });

  const issueTempPassword = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/admin/users/${userId}/issue-temp-password`, {
        method: "POST",
        credentials: "include"
      });
      const data = (await res.json()) as {
        message?: string;
        tempPassword?: string;
        emailSent?: boolean;
        userEmail?: string;
      };
      if (!res.ok) {
        throw new Error(data.message ?? "임시 비밀번호를 발급하지 못했습니다.");
      }
      return data;
    },
    onSuccess: (data) => {
      setPasswordCopyDone(false);
      setTempPasswordModal({
        userEmail: data.userEmail ?? "",
        tempPassword: data.tempPassword ?? "",
        emailSent: Boolean(data.emailSent)
      });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    }
  });

  function closeTempPasswordModal() {
    setTempPasswordModal(null);
    setPasswordCopyDone(false);
  }

  async function copyTempPasswordToClipboard() {
    if (!tempPasswordModal?.tempPassword) {
      return;
    }
    try {
      await navigator.clipboard.writeText(tempPasswordModal.tempPassword);
      setPasswordCopyDone(true);
      window.setTimeout(() => setPasswordCopyDone(false), 2000);
    } catch {
      window.alert("클립보드 복사에 실패했습니다.");
    }
  }

  function toggle(id: string) {
    setOpen((prev) => {
      const n = new Set(prev);
      if (n.has(id)) {
        n.delete(id);
      } else {
        n.add(id);
      }
      return n;
    });
  }

  async function handleDeleteDepartment(dept: Dept, hasChildren: boolean) {
    if (hasChildren) {
      window.alert("하위 부서가 있어 삭제할 수 없습니다.");
      return;
    }
    if (!window.confirm(`'${dept.name}' 부서를 삭제하시겠습니까?`)) {
      return;
    }
    setDeletingDepartmentId(dept.id);
    try {
      await deleteDepartment.mutateAsync(dept.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : "부서를 삭제하지 못했습니다.";
      window.alert(message);
    } finally {
      setDeletingDepartmentId(null);
    }
  }

  async function handleDeleteUser(user: AdminUser) {
    if (user.role === "admin") {
      window.alert("admin 계정은 삭제할 수 없습니다.");
      return;
    }
    if (!window.confirm(`'${user.name}' 사용자를 삭제하시겠습니까?`)) {
      return;
    }
    setDeletingUserId(user.id);
    try {
      await deleteUser.mutateAsync(user.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : "사용자를 삭제하지 못했습니다.";
      window.alert(message);
    } finally {
      setDeletingUserId(null);
    }
  }

  if (meQuery.isLoading) {
    return <p className="text-sm text-slate-500">권한을 확인하는 중…</p>;
  }
  if (meQuery.data && meQuery.data.role !== "admin") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        이 페이지는 관리자(admin)만 사용할 수 있습니다.
      </div>
    );
  }

  return (
    <>
      {tempPasswordModal ? (
        <TempPasswordResultModal
          data={tempPasswordModal}
          copyDone={passwordCopyDone}
          onCopy={() => void copyTempPasswordToClipboard()}
          onClose={closeTempPasswordModal}
        />
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-auto">
      <section className="card-brand rounded-xl p-5">
        <h2 className="text-lg font-semibold text-slate-900">네비게이션 메뉴 표시</h2>
        <p className="mt-1 text-sm text-slate-500">
          체크 해제 시 모든 사용자의 좌측 메뉴에서 해당 항목이 숨겨집니다.{" "}
          <span className="font-medium text-slate-700">관리자</span> 메뉴는 항상 표시되며 여기서 끌 수
          없습니다. 변경 후 <span className="font-medium text-slate-700">저장</span>을 눌러 일괄
          적용합니다.
        </p>
        {navSettingsQuery.isLoading ? (
          <p className="mt-4 text-sm text-slate-500">불러오는 중…</p>
        ) : navSettingsQuery.isError ? (
          <p className="mt-4 text-sm text-red-600">
            {(navSettingsQuery.error as Error).message ?? "설정을 불러오지 못했습니다."}
          </p>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
              {NAV_MENU_ADMIN_ROWS.map((row) => {
                const vis = navDraft ?? navSettingsQuery.data ?? DEFAULT_NAV_VISIBILITY;
                return (
                  <label
                    key={row.key}
                    className="flex cursor-pointer items-center gap-2 text-sm text-slate-800"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300"
                      checked={vis[row.key]}
                      disabled={patchNavSettings.isPending}
                      onChange={(e) =>
                        setNavDraft((prev) => ({
                          ...(prev ?? navSettingsQuery.data ?? DEFAULT_NAV_VISIBILITY),
                          [row.key]: e.target.checked
                        }))
                      }
                    />
                    <span>{row.label}</span>
                  </label>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={patchNavSettings.isPending || !navDraft}
                onClick={() => {
                  if (navDraft) {
                    patchNavSettings.mutate(navDraft);
                  }
                }}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {patchNavSettings.isPending ? "저장 중…" : "저장"}
              </button>
              <button
                type="button"
                disabled={patchNavSettings.isPending}
                onClick={() =>
                  setNavDraft(
                    navSettingsQuery.data ? { ...navSettingsQuery.data } : { ...DEFAULT_NAV_VISIBILITY }
                  )
                }
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                되돌리기
              </button>
            </div>
          </>
        )}
      </section>

      <section className="card-brand rounded-xl p-5">
        <h2 className="text-lg font-semibold text-slate-900">조직도</h2>
        <p className="mt-1 text-sm text-slate-500">접기/펼치기로 하위 부서를 탐색합니다.</p>
        <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
          {deptsQuery.isLoading ? (
            <p className="text-sm text-slate-500">불러오는 중…</p>
          ) : (
            <TreeNodes
              parentId={null}
              depth={0}
              childrenMap={childrenMap}
              open={open}
              toggle={toggle}
              onDeleteDepartment={handleDeleteDepartment}
              deletingDepartmentId={deletingDepartmentId}
            />
          )}
        </div>
      </section>

      <section className="card-brand rounded-xl p-5">
        <h2 className="text-lg font-semibold text-slate-900">부서 추가</h2>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            createDept.mutate();
          }}
        >
          <label className="block text-sm">
            <span className="text-slate-600">이름</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={deptForm.name}
              onChange={(e) => setDeptForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">코드 (영문·고유)</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={deptForm.code}
              onChange={(e) => setDeptForm((f) => ({ ...f, code: e.target.value }))}
              required
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-slate-600">상위 부서 (선택)</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={deptForm.parentId}
              onChange={(e) => setDeptForm((f) => ({ ...f, parentId: e.target.value }))}
            >
              <option value="">(최상위)</option>
              {(deptsQuery.data ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">정렬 순서</span>
            <input
              type="number"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={deptForm.sortOrder}
              onChange={(e) => setDeptForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={createDept.isPending}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {createDept.isPending ? "저장 중…" : "부서 추가"}
            </button>
          </div>
        </form>
      </section>

      <section className="card-brand rounded-xl p-5">
        <h2 className="text-lg font-semibold text-slate-900">사용자 계정 생성</h2>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            createUser.mutate();
          }}
        >
          <label className="block text-sm">
            <span className="text-slate-600">이메일</span>
            <input
              type="email"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={userForm.email}
              onChange={(e) => setUserForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">임시 비밀번호 (8자+, 영문·숫자·특수문자)</span>
            <input
              type="password"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={userForm.password}
              onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))}
              required
              minLength={8}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">이름</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={userForm.name}
              onChange={(e) => setUserForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">역할</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={userForm.role}
              onChange={(e) =>
                setUserForm((f) => ({
                  ...f,
                  role: e.target.value as "admin" | "manager" | "member"
                }))
              }
            >
              <option value="member">member</option>
              <option value="manager">manager</option>
              <option value="admin">admin</option>
            </select>
          </label>
          <div className="block text-sm sm:col-span-2">
            <span className="text-slate-600">부서 배정 (복수 가능)</span>
            <div className="mt-1">
              <DepartmentAssignmentsEditor
                departments={deptsQuery.data ?? []}
                value={userForm.departmentAssignments}
                onChange={(next) =>
                  setUserForm((f) => ({
                    ...f,
                    departmentAssignments: next.filter((x) => Boolean(x.departmentId))
                  }))
                }
              />
            </div>
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={createUser.isPending}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {createUser.isPending ? "생성 중…" : "계정 만들기"}
            </button>
          </div>
        </form>
      </section>

      <section className="card-brand rounded-xl p-5">
        <h2 className="text-lg font-semibold text-slate-900">Excel 일괄 사용자 등록</h2>
        <p className="mt-1 text-sm text-slate-500">
          열: 이메일, 임시비밀번호, 이름, 역할(admin/manager/member), 부서(복수 시 콤마 구분). 부서명은 등록된 부서와
          일치해야 합니다.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <a
            href="/api/admin/users/bulk-import/template"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            템플릿 다운로드 (.xlsx)
          </a>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-900 hover:bg-brand-100">
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) {
                  return;
                }
                setBulkResult(null);
                setBulkBusy(true);
                try {
                  const buf = await f.arrayBuffer();
                  const rows = parseUserImportWorkbook(buf);
                  setBulkParsedRows(rows);
                  const res = await fetchJson<{
                    dryRun: boolean;
                    preview: BulkPreviewRow[];
                    successCount: number;
                    failCount: number;
                  }>("/api/admin/users/bulk-import", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ dryRun: true, rows })
                  });
                  setBulkPreview(res.preview);
                } catch (err) {
                  window.alert(err instanceof Error ? err.message : "파일을 읽지 못했습니다.");
                  setBulkParsedRows(null);
                  setBulkPreview(null);
                } finally {
                  setBulkBusy(false);
                }
              }}
            />
            {bulkBusy ? "처리 중…" : "파일 선택"}
          </label>
        </div>

        {bulkPreview && bulkPreview.length > 0 ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-slate-600">
              미리보기: 성공 예정 {bulkPreview.filter((r) => r.error === null).length}건 · 오류{" "}
              {bulkPreview.filter((r) => r.error !== null).length}건
            </p>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-[880px] w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                    <th className="px-3 py-2">행</th>
                    <th className="px-3 py-2">이메일</th>
                    <th className="px-3 py-2">이름</th>
                    <th className="px-3 py-2">역할</th>
                    <th className="px-3 py-2">부서</th>
                    <th className="px-3 py-2">검증</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkPreview.map((r) => (
                    <tr
                      key={r.rowIndex}
                      className={r.error ? "bg-rose-50/80" : "border-t border-slate-100"}
                    >
                      <td className="px-3 py-2">#{r.rowIndex}</td>
                      <td className="px-3 py-2">{r.email}</td>
                      <td className="px-3 py-2">{r.name}</td>
                      <td className="px-3 py-2">{r.role}</td>
                      <td className="max-w-[200px] truncate px-3 py-2 text-slate-600" title={r.departments}>
                        {r.departments || "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-rose-700">{r.error ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={bulkBusy || !bulkParsedRows?.length}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={async () => {
                  if (!bulkParsedRows?.length) {
                    return;
                  }
                  if (
                    !window.confirm(
                      "검증을 통과한 행만 사용자로 등록합니다. 계속할까요?"
                    )
                  ) {
                    return;
                  }
                  setBulkBusy(true);
                  try {
                    const res = await fetchJson<{
                      successCount: number;
                      failCount: number;
                      failures: Array<{ rowIndex: number; reason: string }>;
                    }>("/api/admin/users/bulk-import", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ dryRun: false, rows: bulkParsedRows })
                    });
                    setBulkResult({
                      successCount: res.successCount,
                      failCount: res.failCount,
                      failures: res.failures ?? []
                    });
                    qc.invalidateQueries({ queryKey: ["admin-users"] });
                    qc.invalidateQueries({ queryKey: ["users"] });
                  } catch (err) {
                    window.alert(err instanceof Error ? err.message : "등록에 실패했습니다.");
                  } finally {
                    setBulkBusy(false);
                  }
                }}
              >
                확인 후 일괄 등록
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setBulkParsedRows(null);
                  setBulkPreview(null);
                  setBulkResult(null);
                }}
              >
                초기화
              </button>
            </div>
          </div>
        ) : null}

        {bulkResult ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <p className="font-medium text-slate-900">
              결과: 성공 {bulkResult.successCount}건 / 실패 {bulkResult.failCount}건
            </p>
            {bulkResult.failures.length > 0 ? (
              <ul className="mt-2 list-inside list-disc space-y-1 text-slate-700">
                {bulkResult.failures.map((f) => (
                  <li key={`${f.rowIndex}-${f.reason}`}>
                    행 {f.rowIndex}: {f.reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="card-brand rounded-xl p-5">
        <h2 className="text-lg font-semibold text-slate-900">비밀번호 재설정 요청</h2>
        <p className="mt-1 text-sm text-slate-500">
          승인 시 임시 비밀번호가 발급되며, SMTP 설정 시 이메일로 발송됩니다. 미설정 시 화면에 표시된 비밀번호를 구두로
          전달해 주세요.
        </p>
        <div className="mt-4 overflow-x-auto">
          {resetReqQuery.isLoading ? (
            <p className="text-sm text-slate-500">불러오는 중…</p>
          ) : (
            <table className="min-w-[720px] w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-3">이름</th>
                  <th className="py-2 pr-3">이메일</th>
                  <th className="py-2 pr-3">요청 시간</th>
                  <th className="py-2 pr-3">상태</th>
                  <th className="py-2">처리</th>
                </tr>
              </thead>
              <tbody>
                {(resetReqQuery.data ?? []).map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-medium text-slate-800">{r.userName}</td>
                    <td className="py-2 pr-3 text-slate-600">{r.userEmail}</td>
                    <td className="py-2 pr-3 text-slate-600">
                      {new Date(r.createdAt).toLocaleString("ko-KR")}
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={
                          r.status === "pending"
                            ? "text-amber-700"
                            : r.status === "completed"
                              ? "text-emerald-700"
                              : "text-slate-500"
                        }
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2">
                      {r.status === "pending" ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={approveReset.isPending || rejectReset.isPending}
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                            onClick={() => {
                              void approveReset.mutate(r.id, {
                                onError: (e) => {
                                  window.alert(e instanceof Error ? e.message : "승인에 실패했습니다.");
                                }
                              });
                            }}
                          >
                            승인
                          </button>
                          <button
                            type="button"
                            disabled={approveReset.isPending || rejectReset.isPending}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            onClick={() => {
                              if (!window.confirm("이 요청을 거절할까요?")) {
                                return;
                              }
                              void rejectReset.mutate(r.id, {
                                onError: (e) => {
                                  window.alert(e instanceof Error ? e.message : "거절에 실패했습니다.");
                                }
                              });
                            }}
                          >
                            거절
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="card-brand rounded-xl p-5">
        <h2 className="text-lg font-semibold text-slate-900">데이터 정리 이력</h2>
        <p className="mt-1 text-sm text-slate-500">
          chat·태스크 첨부파일은 환경설정(기본 30일) 이후 자동 삭제됩니다. 미팅노트 첨부는 보존됩니다. 서버는 매일
          자정에 만료분을 정리하며, 아래에서 수동 실행할 수 있습니다.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={runCleanupNow.isPending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            onClick={() => {
              if (
                !window.confirm(
                  "만료된 첨부파일을 지금 바로 삭제할까요? 서버 디스크와 DB에서 제거되며, 삭제된 파일은 복구할 수 없습니다."
                )
              ) {
                return;
              }
              void runCleanupNow.mutate(undefined, {
                onSuccess: (data) => {
                  window.alert(`정리가 완료되었습니다. 삭제된 파일 ${data.filesDeleted}건`);
                },
                onError: (e) => {
                  window.alert(e instanceof Error ? e.message : "정리에 실패했습니다.");
                }
              });
            }}
          >
            {runCleanupNow.isPending ? "정리 중…" : "지금 정리 실행"}
          </button>
        </div>
        <div className="mt-4 overflow-x-auto">
          {cleanupLogsQuery.isLoading ? (
            <p className="text-sm text-slate-500">불러오는 중…</p>
          ) : (
            <table className="min-w-[520px] w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-3">실행 시간</th>
                  <th className="py-2">삭제된 파일 수</th>
                </tr>
              </thead>
              <tbody>
                {(cleanupLogsQuery.data ?? []).map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3 text-slate-700">
                      {new Date(row.runAt).toLocaleString("ko-KR")}
                    </td>
                    <td className="py-2 font-medium text-slate-800">{row.filesDeleted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {(cleanupLogsQuery.data ?? []).length === 0 && !cleanupLogsQuery.isLoading ? (
            <p className="mt-2 text-sm text-slate-500">아직 정리 이력이 없습니다.</p>
          ) : null}
        </div>
      </section>

      <section className="card-brand rounded-xl p-5">
        <h2 className="text-lg font-semibold text-slate-900">사용자 목록 · 배정</h2>
        <p className="mt-1 text-sm text-slate-500">
          이름·이메일은 부분 일치, 역할·부서 배정은 AND 조건으로 필터됩니다. 적용 시 주소창 쿼리에 반영됩니다.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm">
            <span className="text-slate-600">이름</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="부분 검색"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">이메일</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={filterEmail}
              onChange={(e) => setFilterEmail(e.target.value)}
              placeholder="부분 검색"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">역할</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={filterRole}
              onChange={(e) =>
                setFilterRole(e.target.value as "" | "admin" | "manager" | "member")
              }
            >
              <option value="">전체</option>
              <option value="member">member</option>
              <option value="manager">manager</option>
              <option value="admin">admin</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">부서 배정</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={filterDepartmentId}
              onChange={(e) => setFilterDepartmentId(e.target.value)}
            >
              <option value="">전체</option>
              {(deptsQuery.data ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
            onClick={() => applyUserFilters()}
          >
            필터 적용
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => resetUserFilters()}
          >
            필터 초기화
          </button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[920px] w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 pr-3">이름</th>
                <th className="py-2 pr-3">이메일</th>
                <th className="py-2 pr-3">역할</th>
                <th className="py-2 pr-3">부서 배정</th>
                <th className="py-2 pr-3">저장</th>
                <th className="py-2 pr-3 whitespace-nowrap">임시 비밀번호 발급</th>
                <th className="py-2">삭제</th>
              </tr>
            </thead>
            <tbody>
              {(usersQuery.data ?? []).map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  departments={deptsQuery.data ?? []}
                  onSave={(body) => updateUser.mutate({ id: u.id, body })}
                  onIssueTempPassword={() => {
                    if (
                      !window.confirm(
                        `'${u.name}' 사용자에게 임시 비밀번호를 발급할까요?\n발급 후 해당 계정은 다음 로그인 시 비밀번호를 변경해야 합니다.`
                      )
                    ) {
                      return;
                    }
                    void issueTempPassword.mutate(u.id, {
                      onError: (e) => {
                        window.alert(e instanceof Error ? e.message : "발급에 실패했습니다.");
                      }
                    });
                  }}
                  issueBusy={issueTempPassword.isPending && issueTempPassword.variables === u.id}
                  onDelete={() => void handleDeleteUser(u)}
                  busy={updateUser.isPending}
                  deleteBusy={deletingUserId === u.id}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
    </>
  );
}

function UserRow({
  user,
  departments,
  onSave,
  onIssueTempPassword,
  issueBusy,
  onDelete,
  busy,
  deleteBusy
}: {
  user: AdminUser;
  departments: Dept[];
  onSave: (body: Record<string, unknown>) => void;
  onIssueTempPassword: () => void;
  issueBusy: boolean;
  onDelete: () => void;
  busy: boolean;
  deleteBusy: boolean;
}) {
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState(user.role);
  const [departmentAssignments, setDepartmentAssignments] = useState<DepartmentAssignmentInput[]>(
    user.departmentAssignments.map((a) => ({
      departmentId: a.departmentId,
      role: a.role,
      isPrimary: a.isPrimary
    }))
  );

  useEffect(() => {
    setName(user.name);
    setRole(user.role);
    setDepartmentAssignments(
      user.departmentAssignments.map((a) => ({
        departmentId: a.departmentId,
        role: a.role,
        isPrimary: a.isPrimary
      }))
    );
  }, [user.id, user.name, user.role, user.departmentAssignments]);

  return (
    <tr className="border-b border-slate-100">
      <td className="py-2 pr-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full min-w-[140px] rounded border border-slate-200 px-2 py-1 text-sm font-medium text-slate-800"
          aria-label="사용자 이름"
        />
      </td>
      <td className="py-2 pr-3 text-slate-600">{user.email}</td>
      <td className="py-2 pr-3">
        <select
          className="rounded border border-slate-200 px-2 py-1"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="member">member</option>
          <option value="manager">manager</option>
          <option value="admin">admin</option>
        </select>
      </td>
      <td className="py-2 pr-3">
        <DepartmentAssignmentsEditor
          departments={departments}
          value={departmentAssignments}
          onChange={(next) => setDepartmentAssignments(next.filter((x) => Boolean(x.departmentId)))}
        />
      </td>
      <td className="py-2 pr-3">
        <button
          type="button"
          disabled={busy}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
          onClick={() =>
            onSave({
              name: name.trim(),
              role,
              departmentAssignments
            })
          }
        >
          저장
        </button>
      </td>
      <td className="py-2 pr-3">
        <button
          type="button"
          disabled={issueBusy || user.role === "admin"}
          title={user.role === "admin" ? "admin 계정에는 발급할 수 없습니다" : undefined}
          className="whitespace-nowrap rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onIssueTempPassword}
        >
          {issueBusy ? "발급 중…" : "임시 비밀번호 발급"}
        </button>
      </td>
      <td className="py-2">
        <button
          type="button"
          disabled={deleteBusy || user.role === "admin"}
          className="rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
          onClick={onDelete}
        >
          {deleteBusy ? "삭제 중…" : "삭제"}
        </button>
      </td>
    </tr>
  );
}
