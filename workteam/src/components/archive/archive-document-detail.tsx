"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { pushRecentOpened, removeRecentOpenedByDocumentId } from "@/lib/archive-recent-opened";
import type { DocumentCommentDTO, DocumentDetailDTO, DocumentVersionDTO } from "@/types/archive";
import type { FileAttachmentDTO } from "@/types/files";
import { ArchiveWorkspaceMembersPanel } from "@/components/archive/archive-workspace-members";
import { ROLE_LABEL } from "@/components/archive/archive-ui-helpers";
import { AttachmentList } from "@/components/files/attachment-list";

const ROOT_FOLDERS = [
  { value: "in_progress", label: "진행 중" },
  { value: "completed", label: "완료" },
  { value: "reference", label: "참고" }
] as const;

function parseFolderPath(path: string): { main: string; sub: string } {
  const parts = path.split("/").filter(Boolean);
  const roots = new Set(["in_progress", "completed", "reference"]);
  const main = roots.has(parts[0] ?? "") ? parts[0]! : "in_progress";
  const sub = parts.length > 1 ? parts.slice(1).join("/") : "";
  return { main, sub };
}

function composeFolder(main: string, sub: string): string {
  const t = sub.trim();
  return t ? `${main}/${t}` : main;
}

type DirSearch = {
  departments: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string; email: string }>;
};

export function ArchiveDocumentDetail({
  workspaceId,
  documentId
}: {
  workspaceId: string;
  documentId: string;
}) {
  const qc = useQueryClient();
  const router = useRouter();

  const wsQ = useQuery({
    queryKey: ["workspace-detail", workspaceId],
    queryFn: () =>
      fetchJson<{ workspace: { name: string; myRole: string } }>(
        `/api/workspaces/${encodeURIComponent(workspaceId)}`
      )
  });

  const docQ = useQuery({
    queryKey: ["archive-document", documentId],
    queryFn: () =>
      fetchJson<{ document: DocumentDetailDTO }>(`/api/documents/${encodeURIComponent(documentId)}`)
  });

  const verQ = useQuery({
    queryKey: ["archive-versions", documentId],
    queryFn: () =>
      fetchJson<{ versions: DocumentVersionDTO[] }>(
        `/api/documents/${encodeURIComponent(documentId)}/versions`
      )
  });

  const filesQ = useQuery({
    queryKey: ["document-attachments", documentId],
    queryFn: () =>
      fetchJson<{ attachments: FileAttachmentDTO[] }>(
        `/api/files?entityType=document&entityId=${encodeURIComponent(documentId)}`
      ).then((r) => r.attachments)
  });

  const commentsQ = useQuery({
    queryKey: ["document-comments", documentId],
    queryFn: () =>
      fetchJson<{ comments: DocumentCommentDTO[] }>(
        `/api/documents/${encodeURIComponent(documentId)}/comments`
      ).then((r) => r.comments)
  });

  const doc = docQ.data?.document;
  const myRole = doc?.myRole;
  const canEdit = myRole === "editor" || myRole === "owner";
  const isOwner = myRole === "owner";

  const [bodyDraft, setBodyDraft] = useState("");
  const [verSummary, setVerSummary] = useState("");

  useEffect(() => {
    if (doc?.body !== undefined) {
      setBodyDraft(doc.body);
    }
  }, [doc?.body]);

  const parsedFolder = useMemo(
    () => (doc ? parseFolderPath(doc.folder) : { main: "in_progress", sub: "" }),
    [doc?.folder]
  );
  const [folderMain, setFolderMain] = useState(parsedFolder.main);
  const [folderSub, setFolderSub] = useState(parsedFolder.sub);

  useEffect(() => {
    setFolderMain(parsedFolder.main);
    setFolderSub(parsedFolder.sub);
  }, [parsedFolder.main, parsedFolder.sub]);

  useEffect(() => {
    if (doc && wsQ.data?.workspace.name) {
      pushRecentOpened({
        documentId: doc.id,
        workspaceId: doc.workspaceId,
        title: doc.title,
        workspaceName: wsQ.data.workspace.name
      });
    }
  }, [doc, wsQ.data?.workspace.name]);

  const patch = useMutation({
    mutationFn: (body: { title?: string; folder?: string }) =>
      fetchJson(`/api/documents/${encodeURIComponent(documentId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["archive-document", documentId] });
      await qc.invalidateQueries({ queryKey: ["archive-documents", workspaceId] });
      await qc.invalidateQueries({ queryKey: ["archive-summary"] });
      await qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      await qc.invalidateQueries({ queryKey: ["archive-versions", documentId] });
    }
  });

  const saveBodyVersion = useMutation({
    mutationFn: () =>
      fetchJson(`/api/documents/${encodeURIComponent(documentId)}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: bodyDraft,
          changeSummary: verSummary.trim() || "본문 저장"
        })
      }),
    onSuccess: async () => {
      setVerSummary("");
      await qc.invalidateQueries({ queryKey: ["archive-versions", documentId] });
      await qc.invalidateQueries({ queryKey: ["archive-document", documentId] });
      await qc.invalidateQueries({ queryKey: ["archive-documents", workspaceId] });
      await qc.invalidateQueries({ queryKey: ["archive-summary"] });
      await qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    }
  });

  const deleteDoc = useMutation({
    mutationFn: async () =>
      fetchJson(`/api/documents/${encodeURIComponent(documentId)}`, { method: "DELETE" }),
    onSuccess: async () => {
      removeRecentOpenedByDocumentId(documentId);
      await qc.invalidateQueries({ queryKey: ["archive-documents", workspaceId] });
      await qc.invalidateQueries({ queryKey: ["archive-summary"] });
      await qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      router.push(`/archive/${workspaceId}`);
    }
  });

  const [uploadBusy, setUploadBusy] = useState(false);
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  async function uploadFile(file: File) {
    setUploadBusy(true);
    setFileErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("entityType", "document");
      fd.append("entityId", documentId);
      const res = await fetch("/api/files", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) {
        const j = (await res.json()) as { message?: string };
        throw new Error(j.message ?? "업로드 실패");
      }
      await qc.invalidateQueries({ queryKey: ["document-attachments", documentId] });
    } catch (e) {
      setFileErr(e instanceof Error ? e.message : "업로드에 실패했습니다.");
    } finally {
      setUploadBusy(false);
    }
  }

  async function deleteFile(att: FileAttachmentDTO) {
    if (!window.confirm(`'${att.originalName}' 파일을 삭제할까요?`)) return;
    setDeletingFileId(att.id);
    setFileErr(null);
    try {
      await fetchJson(`/api/files/${encodeURIComponent(att.id)}`, { method: "DELETE" });
      await qc.invalidateQueries({ queryKey: ["document-attachments", documentId] });
    } catch (e) {
      setFileErr(e instanceof Error ? e.message : "파일 삭제에 실패했습니다.");
    } finally {
      setDeletingFileId(null);
    }
  }

  const [commentText, setCommentText] = useState("");
  const [mentionUsers, setMentionUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [mentionSearch, setMentionSearch] = useState("");
  const mentionQ = useQuery({
    queryKey: ["archive-directory-search", mentionSearch],
    queryFn: () =>
      fetchJson<DirSearch>(`/api/archive/directory-search?q=${encodeURIComponent(mentionSearch)}`),
    enabled: mentionSearch.trim().length >= 1
  });

  const postComment = useMutation({
    mutationFn: () =>
      fetchJson(`/api/documents/${encodeURIComponent(documentId)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: commentText.trim(),
          mentionedUserIds:
            mentionUsers.length > 0 ? mentionUsers.map((m) => m.id) : undefined
        })
      }),
    onSuccess: async () => {
      setCommentText("");
      setMentionUsers([]);
      setMentionSearch("");
      await qc.invalidateQueries({ queryKey: ["document-comments", documentId] });
    }
  });

  function addMentionUser(u: { id: string; name: string }) {
    setMentionUsers((prev) => {
      if (prev.some((x) => x.id === u.id)) {
        return prev;
      }
      return [...prev, u];
    });
    setMentionSearch("");
  }

  function removeMention(id: string) {
    setMentionUsers((prev) => prev.filter((x) => x.id !== id));
  }

  if (docQ.isLoading) {
    return <p className="text-sm text-slate-500">문서를 불러오는 중…</p>;
  }
  if (docQ.isError || !doc) {
    return <p className="text-sm text-red-600">{(docQ.error as Error)?.message ?? "오류"}</p>;
  }

  return (
    <div className="flex max-h-[min(80vh,720px)] flex-col gap-4 overflow-y-auto">
      <div>
        <Link
          href={`/archive/${workspaceId}`}
          className="text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          ← 문서 목록
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">{doc.title}</h2>
          {isOwner && (
            <button
              type="button"
              disabled={deleteDoc.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    "이 문서를 삭제할까요? 삭제 후에는 되돌릴 수 없습니다."
                  )
                ) {
                  deleteDoc.mutate();
                }
              }}
              className="shrink-0 rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            >
              문서 삭제
            </button>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>{wsQ.data?.workspace.name ?? "워크스페이스"}</span>
          <span>·</span>
          <span>{doc.folder}</span>
          <span>·</span>
          <span>내 역할 {ROLE_LABEL[doc.myRole]}</span>
        </div>
      </div>

      {doc.editor.embedUrl && (
        <a
          href={doc.editor.embedUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg bg-slate-900 px-3 py-2 text-center text-xs font-medium text-white hover:bg-slate-800"
        >
          외부 편집기 열기 (새 탭)
        </a>
      )}
      {!doc.editor.embedUrl && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          외부 편집기 URL이 설정되지 않았습니다. 본문은 아래에서 직접 수정할 수 있습니다.
        </p>
      )}

      <div className="rounded-xl border border-slate-200 p-3">
        <p className="text-xs font-semibold text-slate-700">문서 본문</p>
        <textarea
          value={bodyDraft}
          onChange={(e) => setBodyDraft(e.target.value)}
          readOnly={!canEdit}
          rows={12}
          className="mt-2 w-full rounded border border-slate-200 px-2 py-2 text-sm leading-relaxed text-slate-800 disabled:bg-slate-50"
          placeholder="내용을 입력하세요."
        />
        {canEdit && (
          <>
            <label className="mt-2 block text-[11px] text-slate-600">
              버전 메모 (선택)
              <input
                value={verSummary}
                onChange={(e) => setVerSummary(e.target.value)}
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                placeholder="예: 초안 수정"
              />
            </label>
            <button
              type="button"
              disabled={saveBodyVersion.isPending}
              onClick={() => saveBodyVersion.mutate()}
              className="mt-2 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              {saveBodyVersion.isPending ? "저장 중…" : "본문 저장 (새 버전)"}
            </button>
          </>
        )}
      </div>

      {canEdit && (
        <div className="space-y-2 rounded-xl border border-slate-200 p-3">
          <p className="text-xs font-semibold text-slate-700">메타데이터</p>
          <label className="block text-xs text-slate-600">
            제목
            <input
              defaultValue={doc.title}
              key={doc.title}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== doc.title) {
                  patch.mutate({ title: v });
                }
              }}
              className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm"
            />
          </label>
          <div className="block text-xs text-slate-600">
            <span className="block">폴더</span>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={folderMain}
                onChange={(e) => {
                  const m = e.target.value;
                  setFolderMain(m);
                  const next = composeFolder(m, folderSub);
                  if (next !== doc.folder) {
                    patch.mutate({ folder: next });
                  }
                }}
                className="w-full rounded border border-slate-200 px-2 py-1 text-sm sm:max-w-[12rem]"
                disabled={patch.isPending}
              >
                {ROOT_FOLDERS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <input
                value={folderSub}
                onChange={(e) => setFolderSub(e.target.value)}
                onBlur={() => {
                  const next = composeFolder(folderMain, folderSub);
                  if (next !== doc.folder) {
                    patch.mutate({ folder: next });
                  }
                }}
                placeholder="하위 폴더 (선택)"
                className="w-full flex-1 rounded border border-slate-200 px-2 py-1 font-mono text-xs"
              />
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 p-3">
        <p className="text-xs font-semibold text-slate-700">첨부파일</p>
        {canEdit && (
          <label className="mt-2 inline-block cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100">
            {uploadBusy ? "업로드 중…" : "파일 선택"}
            <input
              type="file"
              className="hidden"
              disabled={uploadBusy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  void uploadFile(f);
                }
                e.target.value = "";
              }}
            />
          </label>
        )}
        <AttachmentList
          attachments={filesQ.data ?? []}
          canDelete={canEdit}
          deletingId={deletingFileId}
          onDelete={(a) => void deleteFile(a)}
        />
        {fileErr ? <p className="mt-2 text-xs text-rose-600">{fileErr}</p> : null}
        {filesQ.isLoading && <p className="mt-2 text-xs text-slate-500">불러오는 중…</p>}
        {!filesQ.isLoading && (filesQ.data?.length ?? 0) === 0 && (
          <p className="mt-2 text-xs text-slate-500">첨부된 파일이 없습니다.</p>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 p-3">
        <p className="text-xs font-semibold text-slate-700">댓글</p>
        <ul className="mt-3 max-h-56 space-y-3 overflow-y-auto text-xs">
          {(commentsQ.data ?? []).map((c) => (
            <li key={c.id} className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-2">
              <p className="font-medium text-slate-800">{c.userName}</p>
              <p className="mt-1 whitespace-pre-wrap text-slate-700">{c.content}</p>
              <p className="mt-1 text-[10px] text-slate-400">
                {dayjs(c.createdAt).format("YYYY-MM-DD HH:mm")}
              </p>
            </li>
          ))}
          {commentsQ.isLoading && <li className="text-slate-500">불러오는 중…</li>}
        </ul>

        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="text-[11px] font-medium text-slate-600">멘션 알림 받을 사용자</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {mentionUsers.map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-[11px] text-brand-900"
              >
                {m.name}
                <button
                  type="button"
                  className="text-brand-700 hover:text-brand-900"
                  onClick={() => removeMention(m.id)}
                  aria-label="제거"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <input
            value={mentionSearch}
            onChange={(e) => setMentionSearch(e.target.value)}
            placeholder="이름·이메일로 검색 후 선택"
            className="mt-2 w-full rounded border border-slate-200 px-2 py-1 text-xs"
          />
          {mentionSearch.trim().length >= 1 && mentionQ.data && (
            <ul className="mt-1 max-h-32 overflow-y-auto rounded border border-slate-100 bg-white">
              {mentionQ.data.users.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    className="w-full px-2 py-1 text-left text-xs hover:bg-slate-50"
                    onClick={() => addMentionUser(u)}
                  >
                    {u.name} <span className="text-slate-500">({u.email})</span>
                  </button>
                </li>
              ))}
              {mentionQ.data.users.length === 0 && !mentionQ.isFetching && (
                <li className="px-2 py-1 text-xs text-slate-500">검색 결과 없음</li>
              )}
            </ul>
          )}
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            rows={3}
            placeholder="댓글을 입력하세요."
            className="mt-2 w-full rounded border border-slate-200 px-2 py-1 text-xs"
          />
          <button
            type="button"
            disabled={postComment.isPending || !commentText.trim()}
            onClick={() => postComment.mutate()}
            className="mt-2 rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-white disabled:opacity-50"
          >
            댓글 등록
          </button>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-700">버전 이력</p>
        <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto text-xs">
          {(verQ.data?.versions ?? []).map((v) => (
            <li key={v.id} className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-2">
              <div className="flex justify-between gap-2">
                <span className="font-medium">v{v.versionNumber}</span>
              </div>
              <p className="mt-1 text-slate-600">{v.changeSummary ?? "—"}</p>
              <p className="mt-1 text-[10px] text-slate-400">
                {dayjs(v.createdAt).format("YYYY-MM-DD HH:mm")}
              </p>
            </li>
          ))}
          {verQ.isLoading && <li className="text-slate-500">로드 중…</li>}
        </ul>
      </div>

      <details className="rounded-xl border border-slate-200 p-3">
        <summary className="cursor-pointer text-xs font-semibold text-slate-700">워크스페이스 권한</summary>
        <div className="mt-3">
          <ArchiveWorkspaceMembersPanel workspaceId={workspaceId} />
        </div>
      </details>
    </div>
  );
}
