"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import type { WorkspaceRole } from "@/types/archive";
import { ROLE_LABEL } from "@/components/archive/archive-ui-helpers";

type Member = {
  userId: string;
  name: string;
  email: string;
  role: WorkspaceRole;
};

type WsPayload = {
  workspace: { id: string; name: string; myRole: WorkspaceRole };
  members: Member[];
};

type SearchResult = {
  departments: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string; email: string }>;
};

export function ArchiveWorkspaceMembersPanel({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [selectedDeptIds, setSelectedDeptIds] = useState<Set<string>>(new Set());
  const [batchRole, setBatchRole] = useState<WorkspaceRole>("viewer");
  const [batchBusy, setBatchBusy] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(searchInput.trim()), 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const q = useQuery({
    queryKey: ["workspace-detail", workspaceId],
    queryFn: () => fetchJson<WsPayload>(`/api/workspaces/${encodeURIComponent(workspaceId)}`)
  });

  const searchQuery = useQuery({
    queryKey: ["archive-directory-search", debouncedQ],
    queryFn: () =>
      fetchJson<SearchResult>(
        `/api/archive/directory-search?q=${encodeURIComponent(debouncedQ)}`
      ),
    enabled: debouncedQ.length >= 1
  });

  const mut = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      fetchJson("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["workspace-detail", workspaceId] });
    }
  });

  const myRole = q.data?.workspace.myRole;
  const isOwner = myRole === "owner";

  function toggleUser(id: string) {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleDept(id: string) {
    setSelectedDeptIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function batchAdd() {
    setBatchBusy(true);
    try {
      const allIds = new Set<string>(selectedUserIds);
      for (const deptId of selectedDeptIds) {
        const res = await fetchJson<{ users: Array<{ id: string }> }>(
          `/api/archive/department-users?departmentId=${encodeURIComponent(deptId)}`
        );
        for (const u of res.users) {
          allIds.add(u.id);
        }
      }
      for (const userId of allIds) {
        await fetchJson("/api/workspaces", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "setMember",
            workspaceId,
            userId,
            role: batchRole
          })
        });
      }
      setSelectedUserIds(new Set());
      setSelectedDeptIds(new Set());
      setSearchInput("");
      await qc.invalidateQueries({ queryKey: ["workspace-detail", workspaceId] });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "추가에 실패했습니다.");
    } finally {
      setBatchBusy(false);
    }
  }

  const sr = searchQuery.data;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">워크스페이스 권한</h3>
        <p className="mt-1 text-xs text-slate-500">
          {isOwner
            ? "이름·이메일·부서명으로 검색한 뒤, 멤버를 선택해 일괄 추가할 수 있습니다."
            : "멤버 목록은 조회만 가능합니다."}
        </p>
      </div>

      {q.isLoading && <p className="text-sm text-slate-500">불러오는 중…</p>}
      {q.isError && <p className="text-sm text-red-600">{(q.error as Error).message}</p>}

      <ul className="space-y-2 text-sm">
        {(q.data?.members ?? []).map((m) => (
          <li
            key={m.userId}
            className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-medium text-slate-900">{m.name}</p>
              <p className="truncate text-xs text-slate-500">{m.email}</p>
            </div>
            {isOwner ? (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={m.role}
                  onChange={(e) =>
                    mut.mutate({
                      mode: "setMember",
                      workspaceId,
                      userId: m.userId,
                      role: e.target.value as WorkspaceRole
                    })
                  }
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                >
                  <option value="viewer">보기</option>
                  <option value="editor">편집</option>
                  <option value="owner">소유자</option>
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("이 멤버를 삭제할까요?")) {
                      mut.mutate({ mode: "removeMember", workspaceId, userId: m.userId });
                    }
                  }}
                  className="rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
                >
                  삭제
                </button>
              </div>
            ) : (
              <span className="text-xs text-slate-600">{ROLE_LABEL[m.role]}</span>
            )}
          </li>
        ))}
      </ul>

      {isOwner && (
        <div className="rounded-xl border border-dashed border-slate-300 p-3">
          <p className="text-xs font-medium text-slate-700">멤버 검색·일괄 추가</p>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="부서명 또는 사용자 이름·이메일"
            className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
          />
          {searchQuery.isFetching && <p className="mt-2 text-[11px] text-slate-500">검색 중…</p>}
          {debouncedQ.length >= 1 && sr && (
            <div className="mt-3 max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-100 bg-white p-2">
              {sr.departments.length > 0 && (
                <p className="text-[10px] font-semibold uppercase text-slate-500">부서 (전체 멤버 추가)</p>
              )}
              {sr.departments.map((d) => (
                <label
                  key={d.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedDeptIds.has(d.id)}
                    onChange={() => toggleDept(d.id)}
                  />
                  <span className="font-medium text-slate-800">{d.name}</span>
                  <span className="text-slate-400">부서</span>
                </label>
              ))}
              {sr.users.length > 0 && (
                <p className="mt-2 text-[10px] font-semibold uppercase text-slate-500">사용자</p>
              )}
              {sr.users.map((u) => (
                <label
                  key={u.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedUserIds.has(u.id)}
                    onChange={() => toggleUser(u.id)}
                  />
                  <span>
                    {u.name} <span className="text-slate-500">({u.email})</span>
                  </span>
                </label>
              ))}
              {sr.departments.length === 0 && sr.users.length === 0 && !searchQuery.isFetching && (
                <p className="text-xs text-slate-500">검색 결과가 없습니다.</p>
              )}
            </div>
          )}
          <label className="mt-3 block text-[11px] text-slate-600">
            일괄 추가 시 역할
            <select
              value={batchRole}
              onChange={(e) => setBatchRole(e.target.value as WorkspaceRole)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
            >
              <option value="viewer">보기</option>
              <option value="editor">편집</option>
              <option value="owner">소유자</option>
            </select>
          </label>
          <button
            type="button"
            disabled={
              batchBusy ||
              (selectedUserIds.size === 0 && selectedDeptIds.size === 0)
            }
            onClick={() => void batchAdd()}
            className="mt-2 w-full rounded-lg bg-slate-900 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            선택 항목 일괄 추가
          </button>
        </div>
      )}
    </div>
  );
}
