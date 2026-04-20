"use client";

import { useEffect, useState } from "react";
import {
  getNotificationPrefs,
  setNotificationPref,
  type NotificationPrefKey
} from "@/lib/notification-preferences";

type Props = {
  open: boolean;
  onClose: () => void;
};

const ROWS: Array<{ key: NotificationPrefKey; label: string }> = [
  { key: "chat", label: "채팅 알림" },
  { key: "task", label: "태스크 알림" },
  { key: "event", label: "일정 알림 (30분 전)" },
  { key: "archive", label: "아카이브 문서 멘션 알림" }
];

export function NotificationSettingsModal({ open, onClose }: Props) {
  const [prefs, setPrefs] = useState(getNotificationPrefs);

  useEffect(() => {
    if (open) {
      setPrefs(getNotificationPrefs());
    }
  }, [open]);

  if (!open) {
    return null;
  }

  function toggle(key: NotificationPrefKey) {
    const next = !prefs[key];
    setNotificationPref(key, next);
    setPrefs((p) => ({ ...p, [key]: next }));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900">알림 설정</h2>
        <p className="mt-1 text-sm text-slate-600">브라우저 알림 수신 범위를 선택합니다. (이 기기에만 저장)</p>
        <ul className="mt-6 space-y-4">
          {ROWS.map((row) => (
            <li key={row.key} className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-slate-800">{row.label}</span>
              <button
                type="button"
                role="switch"
                aria-checked={prefs[row.key]}
                onClick={() => toggle(row.key)}
                className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                  prefs[row.key] ? "bg-brand-600" : "bg-slate-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                    prefs[row.key] ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
