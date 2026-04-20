"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { removeRecentOpenedByWorkspaceId } from "@/lib/archive-recent-opened";
import { fetchJson } from "@/lib/fetch-json";
import type { DocumentDTO } from "@/types/archive";
import type { WorkspaceDTO } from "@/types/archive";

const ROOTS = ["in_progress", "completed", "reference"] as const;

export function ArchiveWorkspaceShell({
  workspaceId,
  children
}: {
  workspaceId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const folderFilter = searchParams.get("folder") ?? "";

  const workspacesQuery = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => fetchJson<{ workspaces: WorkspaceDTO[] }>("/api/workspaces")
  });

  const docsQuery = useQuery({
    queryKey: ["archive-documents", workspaceId],
    queryFn: () =>
      fetchJson<{ documents: DocumentDTO[] }>(
        `/api/documents?workspaceId=${encodeURIComponent(workspaceId)}`
      )
  });

  const documents = docsQuery.data?.documents ?? [];

  const filtered = useMemo(() => {
    if (!folderFilter) {
      return documents;
    }
    return documents.filter((d) => d.folder === folderFilter || d.folder.startsWith(`${folderFilter}/`));
  }, [documents, folderFilter]);

  const subFolders = useMemo(() => {
    const set = new Set<string>();
    for (const d of documents) {
      if (!folderFilter) {
        continue;
      }
      if (d.folder.startsWith(`${folderFilter}/`)) {
        const rest = d.folder.slice(folderFilter.length + 1);
        const seg = rest.split("/")[0];
        if (seg) {
          set.add(`${folderFilter}/${seg}`);
        }
      }
    }
    return [...set].sort();
  }, [documents, folderFilter]);

  const [createOpen, setCreateOpen] = useState(false);

  const wsList = workspacesQuery.data?.workspaces ?? [];
  const currentWs = wsList.find((w) => w.id === workspaceId);
  const canEdit = currentWs?.myRole === "editor" || currentWs?.myRole === "owner";
  const isOwner = currentWs?.myRole === "owner";

  const deleteWs = useMutation({
    mutationFn: async () =>
      fetchJson<{ ok: boolean }>(`/api/workspaces/${encodeURIComponent(workspaceId)}`, {
        method: "DELETE"
      }),
    onSuccess: async () => {
      removeRecentOpenedByWorkspaceId(workspaceId);
      await qc.invalidateQueries({ queryKey: ["workspaces"] });
      await qc.invalidateQueries({ queryKey: ["archive-summary"] });
      router.push("/archive");
    }
  });

  function confirmDeleteWorkspace() {
    const n = documents.length;
    let msg = "이 워크스페이스를 삭제할까요?";
    if (n > 0) {
      msg = `워크스페이스에 문서 ${n}개가 있습니다. 문서를 모두 삭제 후 워크스페이스를 삭제합니다. 계속하시겠습니까?`;
    }
    if (!window.confirm(msg)) {
      return;
    }
    deleteWs.mutate();
  }

  function setFolder(f: string) {
    const q = new URLSearchParams(searchParams.toString());
    if (!f) {
      q.delete("folder");
    } else {
      q.set("folder", f);
    }
    router.push(`/archive/${workspaceId}?${q.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/archive"
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          ← 아카이브 홈
        </Link>
        {isOwner && (
          <button
            type="button"
            onClick={() => confirmDeleteWorkspace()}
            disabled={deleteWs.isPending}
            className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
          >
            워크스페이스 삭제
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {wsList.map((w) => (
          <Link
            key={w.id}
            href={`/archive/${w.id}`}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              w.id === workspaceId
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {w.name}
          </Link>
        ))}
        {workspacesQuery.isLoading && <span className="text-sm text-slate-500">탭 로드 중…</span>}
      </div>

      <div className="grid min-h-[560px] grid-cols-1 gap-5 lg:grid-cols-[1fr_2.5fr_2.5fr] lg:gap-6">
        <aside className="card-brand rounded-2xl p-4 lg:p-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">폴더</p>
          <ul className="mt-3 space-y-1.5 text-sm">
            <li>
              <button
                type="button"
                onClick={() => setFolder("")}
                className={`w-full rounded-lg px-2 py-1.5 text-left ${!folderFilter ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}
              >
                전체
              </button>
            </li>
            {ROOTS.map((r) => (
              <li key={r}>
                <button
                  type="button"
                  onClick={() => setFolder(r)}
                  className={`w-full rounded-lg px-2 py-1.5 text-left ${
                    folderFilter === r ? "bg-slate-900 text-white" : "hover:bg-slate-100"
                  }`}
                >
                  {r === "in_progress" ? "진행 중" : r === "completed" ? "완료" : "참고"}
                </button>
              </li>
            ))}
            {subFolders.map((sf) => (
              <li key={sf}>
                <button
                  type="button"
                  onClick={() => setFolder(sf)}
                  className={`w-full rounded-lg px-2 py-1.5 text-left text-xs ${
                    folderFilter === sf ? "bg-slate-900 text-white" : "hover:bg-slate-100"
                  }`}
                >
                  {sf}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="card-brand min-w-0 rounded-2xl p-5 lg:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">문서</h2>
            {canEdit && (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
              >
                새 문서
              </button>
            )}
          </div>
          {docsQuery.isLoading && <p className="mt-4 text-sm text-slate-500">불러오는 중…</p>}
          {docsQuery.isError && (
            <p className="mt-4 text-sm text-red-600">{(docsQuery.error as Error).message}</p>
          )}
          <ul className="mt-4 divide-y divide-slate-200">
            {filtered.map((d) => {
              const active = pathname === `/archive/${workspaceId}/${d.id}`;
              return (
                <li key={d.id}>
                  <Link
                    href={`/archive/${workspaceId}/${d.id}`}
                    className={`flex flex-wrap items-center justify-between gap-2 py-3 text-sm ${
                      active ? "bg-slate-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <span className="font-medium text-slate-900">{d.title}</span>
                    <span className="text-xs text-slate-500">{d.folder}</span>
                  </Link>
                </li>
              );
            })}
            {!docsQuery.isLoading && filtered.length === 0 && (
              <li className="py-8 text-center text-sm text-slate-500">문서가 없습니다.</li>
            )}
          </ul>
        </section>

        <aside className="card-brand min-h-[360px] rounded-2xl p-5 text-[15px] lg:min-h-0 lg:p-6 lg:[&_summary]:text-base lg:[&_h2]:text-xl lg:[&_h3]:text-lg lg:[&_p]:text-sm lg:[&_button]:text-sm lg:[&_button]:font-medium lg:[&_input]:text-sm lg:[&_select]:text-sm lg:[&_textarea]:text-sm">
          {children}
        </aside>
      </div>

      {createOpen && canEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <CreateDocumentModal
            workspaceId={workspaceId}
            defaultFolder={folderFilter || "in_progress"}
            onClose={() => setCreateOpen(false)}
            onCreated={(docId) => {
              setCreateOpen(false);
              router.push(`/archive/${workspaceId}/${docId}`);
            }}
          />
        </div>
      )}
    </div>
  );
}

const FOLDER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "in_progress", label: "진행 중" },
  { value: "completed", label: "완료" },
  { value: "reference", label: "참고" }
];

function folderMainFromPath(path: string): string {
  const first = path.split("/")[0] ?? "in_progress";
  return ["in_progress", "completed", "reference"].includes(first) ? first : "in_progress";
}

function CreateDocumentModal({
  workspaceId,
  defaultFolder,
  onClose,
  onCreated
}: {
  workspaceId: string;
  defaultFolder: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [folderMain, setFolderMain] = useState(() => folderMainFromPath(defaultFolder));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetchJson<{ documentId?: string }>("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          workspaceId,
          folder: folderMain
        })
      });
      if (res.documentId) {
        await qc.invalidateQueries({ queryKey: ["archive-documents", workspaceId] });
        await qc.invalidateQueries({ queryKey: ["archive-summary"] });
        onCreated(res.documentId);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
      <h3 className="text-lg font-semibold">문서 만들기</h3>
      <label className="mt-4 block text-sm text-slate-600">
        제목
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </label>
      <label className="mt-3 block text-sm text-slate-600">
        폴더
        <select
          value={folderMain}
          onChange={(e) => setFolderMain(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          {FOLDER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-slate-600">
          취소
        </button>
        <button
          type="button"
          disabled={!title.trim() || busy}
          onClick={() => void submit()}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          만들기
        </button>
      </div>
    </div>
  );
}
