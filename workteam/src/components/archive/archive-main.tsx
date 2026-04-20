"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import {
  readRecentOpened,
  replaceRecentOpened,
  type RecentOpenedEntry
} from "@/lib/archive-recent-opened";
import type { DocumentDTO } from "@/types/archive";

type Summary = {
  workspaces: Array<{
    id: string;
    name: string;
    type: string;
    documentCount: number;
    memberCount: number;
    lastActivityAt: string | null;
  }>;
  recentModifiedDocuments: Array<{
    id: string;
    title: string;
    workspaceId: string;
    workspaceName: string;
    modifiedAt: string;
  }>;
};

type DeptRow = { id: string; name: string; code: string };

export function ArchiveMain() {
  const qc = useQueryClient();
  const pathname = usePathname();
  const [recentOpened, setRecentOpened] = useState<RecentOpenedEntry[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [wsName, setWsName] = useState("");
  const [wsType, setWsType] = useState<"org" | "custom">("custom");
  const [departmentId, setDepartmentId] = useState("");

  const summaryQuery = useQuery({
    queryKey: ["archive-summary"],
    queryFn: () => fetchJson<Summary>("/api/archive/summary")
  });

  const departmentsQuery = useQuery({
    queryKey: ["departments-archive-modal"],
    queryFn: () => fetchJson<{ departments: DeptRow[] }>("/api/departments"),
    enabled: createOpen && wsType === "org"
  });

  const refreshRecentOpened = useCallback(async () => {
    const entries = readRecentOpened();
    if (entries.length === 0) {
      setRecentOpened([]);
      return;
    }

    const byWorkspace = new Map<string, Set<string>>();
    for (const e of entries) {
      if (!byWorkspace.has(e.workspaceId)) {
        byWorkspace.set(e.workspaceId, new Set());
      }
      byWorkspace.get(e.workspaceId)!.add(e.documentId);
    }

    const alive = new Set<string>();
    await Promise.all(
      [...byWorkspace.keys()].map(async (workspaceId) => {
        try {
          const res = await fetchJson<{ documents: DocumentDTO[] }>(
            `/api/documents?workspaceId=${encodeURIComponent(workspaceId)}`
          );
          for (const d of res.documents) {
            alive.add(`${workspaceId}:${d.id}`.toLowerCase());
          }
        } catch {
          void 0;
        }
      })
    );

    const pruned = entries.filter((e) =>
      alive.has(`${e.workspaceId}:${e.documentId}`.toLowerCase())
    );
    setRecentOpened(pruned);
    if (pruned.length !== entries.length) {
      replaceRecentOpened(pruned);
    }
  }, []);

  useEffect(() => {
    void refreshRecentOpened();
  }, [pathname, summaryQuery.dataUpdatedAt, refreshRecentOpened]);

  useEffect(() => {
    function onSync() {
      void refreshRecentOpened();
    }
    window.addEventListener("archive:recentOpenedChanged", onSync);
    window.addEventListener("storage", onSync);
    window.addEventListener("focus", onSync);
    return () => {
      window.removeEventListener("archive:recentOpenedChanged", onSync);
      window.removeEventListener("storage", onSync);
      window.removeEventListener("focus", onSync);
    };
  }, [refreshRecentOpened]);

  const createWs = useMutation({
    mutationFn: () => {
      if (wsType === "org") {
        return fetchJson<{ ok: boolean; workspaceId?: string }>("/api/workspaces", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "create",
            workspaceType: "org",
            departmentId
          })
        });
      }
      return fetchJson<{ ok: boolean; workspaceId?: string }>("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "create",
          workspaceType: "custom",
          name: wsName.trim()
        })
      });
    },
    onSuccess: async () => {
      setCreateOpen(false);
      setWsName("");
      setDepartmentId("");
      await qc.invalidateQueries({ queryKey: ["archive-summary"] });
      await qc.invalidateQueries({ queryKey: ["workspaces"] });
    }
  });

  const data = summaryQuery.data;
  const empty = !summaryQuery.isLoading && (data?.workspaces.length ?? 0) === 0;
  const depts = departmentsQuery.data?.departments ?? [];

  const createDisabled =
    createWs.isPending ||
    (wsType === "custom" && !wsName.trim()) ||
    (wsType === "org" && !departmentId);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">문서 아카이브</h1>
          <p className="mt-1 text-sm text-slate-500">워크스페이스별로 문서를 정리하고 버전·댓글로 협업합니다.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow hover:bg-slate-800"
        >
          워크스페이스 만들기
        </button>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">워크스페이스</h2>
        {summaryQuery.isLoading && <p className="mt-4 text-sm text-slate-500">불러오는 중…</p>}
        {summaryQuery.isError && (
          <p className="mt-4 text-sm text-red-600">{(summaryQuery.error as Error).message}</p>
        )}
        {empty && (
          <div className="card-brand mt-4 rounded-2xl border border-dashed border-slate-300 p-10 text-center">
            <p className="text-sm text-slate-600">아직 워크스페이스가 없습니다.</p>
            <p className="mt-2 text-sm text-slate-500">
              상단의 <span className="font-medium text-slate-700">워크스페이스 만들기</span>로 새 워크스페이스를
              추가해 보세요.
            </p>
          </div>
        )}
        {!empty && data && (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.workspaces.map((w) => (
              <li key={w.id}>
                <Link
                  href={`/archive/${w.id}`}
                  className="card-brand block rounded-2xl p-5 transition hover:border-slate-300"
                >
                  <p className="font-semibold text-slate-900">{w.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{w.type === "org" ? "조직" : "사용자 정의"}</p>
                  <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-600">
                    <span>문서 {w.documentCount}</span>
                    <span>멤버 {w.memberCount}</span>
                  </div>
                  <p className="mt-3 text-xs text-slate-400">
                    최근 활동{" "}
                    {w.lastActivityAt ? dayjs(w.lastActivityAt).format("YYYY-MM-DD HH:mm") : "—"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">최근 열어본 문서</h2>
          <ul className="mt-4 space-y-2">
            {recentOpened.length === 0 && (
              <li className="text-sm text-slate-500">아직 기록이 없습니다. 문서를 열면 여기에 표시됩니다.</li>
            )}
            {recentOpened.map((e) => (
              <li key={e.documentId}>
                <Link
                  href={`/archive/${e.workspaceId}/${e.documentId}`}
                  className="flex flex-col rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm hover:bg-slate-100"
                >
                  <span className="font-medium text-slate-900">{e.title}</span>
                  <span className="mt-1 text-xs text-slate-500">{e.workspaceName}</span>
                  <span className="mt-1 text-xs text-slate-400">
                    {dayjs(e.openedAt).format("YYYY-MM-DD HH:mm")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">최근 수정된 문서</h2>
          <ul className="mt-4 space-y-2">
            {(data?.recentModifiedDocuments ?? []).length === 0 && !summaryQuery.isLoading && (
              <li className="text-sm text-slate-500">수정된 문서가 없습니다.</li>
            )}
            {(data?.recentModifiedDocuments ?? []).map((d) => (
              <li key={d.id}>
                <Link
                  href={`/archive/${d.workspaceId}/${d.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm hover:bg-slate-100"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{d.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{d.workspaceName}</p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">
                    {dayjs(d.modifiedAt).format("MM-DD HH:mm")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">워크스페이스 만들기</h3>
            <label className="mt-4 block text-sm text-slate-600">
              유형
              <select
                value={wsType}
                onChange={(e) => setWsType(e.target.value as "org" | "custom")}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="custom">사용자 정의 (이름 직접 입력)</option>
                <option value="org">조직 (부서 연동)</option>
              </select>
            </label>

            {wsType === "custom" && (
              <label className="mt-3 block text-sm text-slate-600">
                워크스페이스 이름
                <input
                  value={wsName}
                  onChange={(e) => setWsName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="예: 기획 문서함"
                />
              </label>
            )}

            {wsType === "org" && (
              <label className="mt-3 block text-sm text-slate-600">
                부서 선택
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">부서를 선택하세요</option>
                  {depts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {createWs.isError && (
              <p className="mt-2 text-sm text-red-600">{(createWs.error as Error).message}</p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                취소
              </button>
              <button
                type="button"
                disabled={createDisabled}
                onClick={() => createWs.mutate()}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                만들기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
