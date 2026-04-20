"use client";

import clsx from "clsx";
import type { FileAttachmentDTO } from "@/types/files";

export function AttachmentList({
  attachments,
  compact
}: {
  attachments: FileAttachmentDTO[];
  compact?: boolean;
}) {
  if (attachments.length === 0) {
    return null;
  }
  return (
    <div className={clsx("mt-2 flex flex-wrap gap-2", compact && "mt-1")}>
      {attachments.map((a) =>
        a.expired ? (
          <div
            key={a.id}
            className="flex max-w-[220px] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-left text-xs text-slate-500"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-slate-100 text-lg">
              📎
            </span>
            <span className="min-w-0 flex-1 truncate font-medium text-slate-600">
              {a.originalName}
              <span className="text-rose-600"> · 기간 만료</span>
            </span>
          </div>
        ) : (
          <a
            key={a.id}
            href={a.url}
            target="_blank"
            rel="noreferrer"
            className="flex max-w-[220px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-left text-xs shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            {a.isImage && a.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={a.previewUrl}
                alt=""
                className="h-10 w-10 shrink-0 rounded object-cover"
              />
            ) : (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-slate-100 text-lg">
                📎
              </span>
            )}
            <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{a.originalName}</span>
            <span className="shrink-0 text-[10px] text-slate-400">
              {(a.byteSize / 1024).toFixed(0)}KB
            </span>
          </a>
        )
      )}
    </div>
  );
}
