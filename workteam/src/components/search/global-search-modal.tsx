"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import type { GlobalSearchItemDTO, GlobalSearchType } from "@/types/search";

type Props = {
  open: boolean;
  onClose: () => void;
};

const CATEGORY_LABEL: Record<GlobalSearchItemDTO["category"], string> = {
  chat: "채팅",
  task: "태스크",
  note: "노트",
  event: "일정",
  file: "파일"
};

const CATEGORY_ICON: Record<GlobalSearchItemDTO["category"], string> = {
  chat: "💬",
  task: "✅",
  note: "📝",
  event: "📅",
  file: "📎"
};

function formatKoreanDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(
    2,
    "0"
  )}`;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function Highlight({ text, q }: { text: string; q: string }) {
  const query = q.trim();
  const parts = useMemo(() => {
    if (!query) return [text];
    const re = new RegExp(`(${escapeRegExp(query)})`, "ig");
    return text.split(re);
  }, [text, query]);

  if (!query) return <>{text}</>;

  return (
    <>
      {parts.map((p, idx) => {
        const isHit = idx % 2 === 1;
        return isHit ? (
          <mark key={idx} className="rounded bg-amber-200/70 px-0.5">
            {p}
          </mark>
        ) : (
          <span key={idx}>{p}</span>
        );
      })}
    </>
  );
}

export function GlobalSearchModal({ open, onClose }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [q, setQ] = useState("");
  const [type, setType] = useState<GlobalSearchType>("all");
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<GlobalSearchItemDTO[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open]);

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

  useEffect(() => {
    if (!open) return;
    const qTrim = q.trim();
    if (qTrim.length < 1) {
      setItems([]);
      setError(null);
      return;
    }

    setBusy(true);
    setError(null);
    const handle = window.setTimeout(() => {
      (async () => {
        try {
          const data = await fetchJson<{ items: GlobalSearchItemDTO[] }>(
            `/api/search?q=${encodeURIComponent(qTrim)}&type=${encodeURIComponent(type)}`
          );
          setItems(data.items ?? []);
        } catch (e) {
          const message = e instanceof Error ? e.message : "검색에 실패했습니다.";
          setError(message);
          setItems([]);
        } finally {
          setBusy(false);
        }
      })();
    }, 300);

    return () => window.clearTimeout(handle);
  }, [q, type, open]);

  const grouped = useMemo(() => {
    const map = new Map<GlobalSearchItemDTO["category"], GlobalSearchItemDTO[]>();
    for (const it of items) {
      const arr = map.get(it.category) ?? [];
      arr.push(it);
      map.set(it.category, arr);
    }
    return (["chat", "task", "note", "event", "file"] as const).map((cat) => ({
      category: cat,
      items: map.get(cat) ?? []
    }));
  }, [items]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-12"
      role="dialog"
      aria-modal="true"
    >
      <div className="card-brand w-full max-w-3xl overflow-hidden rounded-2xl shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="검색어를 입력하세요 (채팅/태스크/노트/일정/파일)…"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
            <select
              value={type}
              onChange={(e) => setType(e.target.value as GlobalSearchType)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-700 outline-none focus:border-brand-400"
            >
              <option value="all">전체</option>
              <option value="chat">채팅</option>
              <option value="task">태스크</option>
              <option value="note">노트</option>
              <option value="event">일정</option>
              <option value="file">파일</option>
            </select>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            닫기 (ESC)
          </button>
        </div>

        <div className="max-h-[70vh] overflow-auto px-4 py-4">
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {!error && q.trim().length < 1 ? (
            <p className="text-sm text-slate-500">검색어를 입력하면 결과가 실시간으로 표시됩니다.</p>
          ) : null}
          {busy ? <p className="mt-2 text-xs text-slate-400">검색 중…</p> : null}

          {grouped.map((g) => {
            if (g.items.length === 0) return null;
            return (
              <div key={g.category} className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-500">{CATEGORY_LABEL[g.category]}</p>
                  <p className="text-xs text-slate-400">{g.items.length}건</p>
                </div>
                <div className="space-y-2">
                  {g.items.map((it) => (
                    <Link
                      key={`${it.category}:${it.id}`}
                      href={it.link}
                      onClick={onClose}
                      className="block rounded-xl border border-slate-200 bg-white p-3 transition hover:bg-slate-50"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 text-lg">{CATEGORY_ICON[it.category]}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <p className="min-w-0 truncate text-sm font-semibold text-slate-900">
                              <Highlight text={it.title} q={q} />
                            </p>
                            <p className="shrink-0 text-xs text-slate-400">{formatKoreanDate(it.occurredAt)}</p>
                          </div>
                          <div className="mt-0.5 flex items-center justify-between gap-3">
                            <p className="min-w-0 truncate text-xs text-slate-500">
                              {it.departmentName ? it.departmentName : "—"}
                            </p>
                          </div>
                          {it.snippet ? (
                            <p className="mt-1 line-clamp-2 text-sm text-slate-700">
                              <Highlight text={it.snippet} q={q} />
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}

          {!busy && q.trim().length >= 1 && items.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">검색 결과가 없습니다.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

