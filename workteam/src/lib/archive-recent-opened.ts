"use client";

const STORAGE_KEY = "archive:recentOpened";

/** 같은 탭에서도 최근 열어본 목록 UI가 갱신되도록 브로드캐스트합니다. */
function notifyRecentOpenedChanged() {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event("archive:recentOpenedChanged"));
}

export type RecentOpenedEntry = {
  documentId: string;
  workspaceId: string;
  title: string;
  workspaceName: string;
  openedAt: string;
};

function writeRecentOpened(entries: RecentOpenedEntry[]) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  notifyRecentOpenedChanged();
}

export function readRecentOpened(): RecentOpenedEntry[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (x): x is RecentOpenedEntry =>
        typeof x === "object" &&
        x !== null &&
        typeof (x as RecentOpenedEntry).documentId === "string"
    );
  } catch {
    return [];
  }
}

export function removeRecentOpenedByWorkspaceId(workspaceId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  const wid = workspaceId.trim().toLowerCase();
  try {
    const prev = readRecentOpened().filter(
      (e) => e.workspaceId.trim().toLowerCase() !== wid
    );
    writeRecentOpened(prev);
  } catch {
    void 0;
  }
}

export function removeRecentOpenedByDocumentId(documentId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  const id = documentId.trim().toLowerCase();
  try {
    const prev = readRecentOpened().filter(
      (e) => e.documentId.trim().toLowerCase() !== id
    );
    writeRecentOpened(prev);
  } catch {
    void 0;
  }
}

export function replaceRecentOpened(entries: RecentOpenedEntry[]): void {
  writeRecentOpened(entries);
}

export function pushRecentOpened(entry: Omit<RecentOpenedEntry, "openedAt">): void {
  if (typeof window === "undefined") {
    return;
  }
  const next: RecentOpenedEntry = {
    ...entry,
    openedAt: new Date().toISOString()
  };
  const prev = readRecentOpened().filter((e) => e.documentId !== entry.documentId);
  const merged = [next, ...prev].slice(0, 5);
  writeRecentOpened(merged);
}
