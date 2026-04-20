"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ComponentType, type ReactNode, useEffect, useMemo, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import type { NavMenuKey } from "@/lib/navigation-settings";
import {
  IconActivity,
  IconAdmin,
  IconArchive,
  IconCalendar,
  IconChat,
  IconDashboard,
  IconNotes,
  IconSettings,
  IconTasks
} from "@/components/layout/nav-menu-icons";
import { NotificationSettingsModal } from "@/components/layout/notification-settings-modal";
import { QuickAddModal } from "@/components/quick-add/quick-add-modal";
import { GlobalSearchModal } from "@/components/search/global-search-modal";
import { useCalendarReminders } from "@/hooks/use-calendar-reminders";
import { useWorkspaceBadges } from "@/hooks/use-workspace-badges";

type MenuItem = {
  href: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  badgeKey?: "chat" | "tasks" | "calendar" | "meetingNotes" | "activity";
  /** Omitted for 관리자 — always shown to admins, not configurable */
  navKey?: NavMenuKey;
};

const menuItems: MenuItem[] = [
  { href: "/dashboard", label: "대시보드", Icon: IconDashboard, navKey: "dashboard" },
  { href: "/chat", label: "채팅", Icon: IconChat, badgeKey: "chat", navKey: "chat" },
  { href: "/tasks", label: "태스크/칸반", Icon: IconTasks, badgeKey: "tasks", navKey: "tasks" },
  { href: "/calendar", label: "캘린더", Icon: IconCalendar, badgeKey: "calendar", navKey: "calendar" },
  { href: "/meeting-notes", label: "미팅노트", Icon: IconNotes, badgeKey: "meetingNotes", navKey: "meeting_notes" },
  { href: "/activity-feed", label: "액티비티피드", Icon: IconActivity, badgeKey: "activity", navKey: "activity_feed" },
  { href: "/archive", label: "아카이브", Icon: IconArchive, navKey: "archive" },
  { href: "/admin", label: "관리자", Icon: IconAdmin }
];

const pageTitleByPath: Record<string, string> = {
  "/dashboard": "대시보드",
  "/chat": "채팅",
  "/tasks": "태스크/칸반",
  "/calendar": "캘린더",
  "/meeting-notes": "미팅노트",
  "/activity-feed": "액티비티피드",
  "/admin": "관리자",
  "/account/password": "비밀번호 변경"
};

function resolvePageTitle(pathname: string) {
  if (pathname.startsWith("/account/password")) {
    return "비밀번호 변경";
  }
  if (pathname === "/archive" || pathname.startsWith("/archive/")) {
    return "문서 아카이브";
  }
  return pageTitleByPath[pathname] ?? "업무협업 사이트";
}

function isMenuActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function initialsFromName(name: string) {
  const t = name.trim();
  if (!t) return "?";
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]!.slice(0, 1) + parts[1]!.slice(0, 1)).toUpperCase();
  }
  return t.slice(0, 2).toUpperCase();
}

type Me = {
  id: string;
  name: string;
  email: string;
  role: string;
  departmentName: string | null;
  secondaryDepartments?: Array<{ departmentId: string; departmentName: string }>;
};

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const pageTitle = resolvePageTitle(pathname);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [notificationSettingsOpen, setNotificationSettingsOpen] = useState(false);

  const { display: badgeDisplay } = useWorkspaceBadges(me?.id ?? null);
  useCalendarReminders(Boolean(me?.id));

  const navVisibilityQuery = useQuery({
    queryKey: ["navigation-settings"],
    queryFn: () =>
      fetchJson<{ visibility: Record<string, boolean> }>("/api/navigation-settings").then(
        (r) => r.visibility
      ),
    staleTime: 0,
    refetchInterval: 12_000,
    refetchOnWindowFocus: true
  });

  const avatarLabel = useMemo(() => initialsFromName(me?.name ?? ""), [me?.name]);

  function navBadgeCount(key: MenuItem["badgeKey"]): number {
    if (!key) {
      return 0;
    }
    switch (key) {
      case "chat":
        return badgeDisplay.chat;
      case "tasks":
        return badgeDisplay.tasks;
      case "calendar":
        return badgeDisplay.calendar;
      case "meetingNotes":
        return badgeDisplay.meetingNotes;
      case "activity":
        return badgeDisplay.activity;
      default:
        return 0;
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchJson<{
          user: Me;
        }>("/api/chat/me");
        if (!cancelled) {
          setMe(data.user);
        }
      } catch {
        void 0;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isK = e.key.toLowerCase() === "k";
      if (e.ctrlKey && isK) {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function handleLogout() {
    if (logoutBusy) return;
    setLogoutBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      void 0;
    } finally {
      window.location.assign("/");
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-slate-900">
      <div className="flex min-h-screen">
        <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200/90 bg-white px-3 py-4">
          <Link
            href="/dashboard"
            className="mb-5 flex items-center gap-3 rounded-xl border border-slate-200/90 bg-[#FAFAF8] px-3 py-3 transition hover:border-slate-300"
          >
            <Image
              src="/logo.png"
              alt="한화투자증권 로고"
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 rounded-md object-contain"
            />
            <div className="min-w-0">
              <p className="text-[15px] font-semibold leading-tight text-slate-900">한화투자증권</p>
              <p className="mt-0.5 text-xs leading-snug text-slate-500">내부망 업무 협업툴</p>
            </div>
          </Link>

          <nav className="flex-1 space-y-0.5">
            {menuItems.map((item) => {
              if (item.href === "/admin" && me?.role !== "admin") {
                return null;
              }
              if (item.navKey) {
                const vis = navVisibilityQuery.data;
                if (vis && vis[item.navKey] === false) {
                  return null;
                }
              }
              const active = isMenuActive(pathname, item.href);
              const Icon = item.Icon;
              const bc = navBadgeCount(item.badgeKey);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg py-2.5 pl-3 pr-3 text-[15px] leading-snug transition ${
                    active
                      ? "border-l-[3px] border-brand-500 bg-brand-100 font-semibold text-brand-600"
                      : "border-l-[3px] border-transparent text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Icon className={`h-5 w-5 shrink-0 ${active ? "text-brand-600" : "text-slate-500"}`} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {bc > 0 ? (
                    <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold leading-none text-white">
                      {bc > 99 ? "99+" : bc}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="mt-3 flex justify-end px-1">
            <button
              type="button"
              aria-label="알림 설정"
              onClick={() => setNotificationSettingsOpen(true)}
              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            >
              <IconSettings className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-auto space-y-3 rounded-xl border border-slate-200/90 bg-[#FAFAF8] p-3">
            <div className="flex items-start gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700"
                aria-hidden
              >
                {avatarLabel}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{me?.name ?? "…"}</p>
                {me?.departmentName ? (
                  <p className="mt-0.5 truncate text-xs text-slate-500">{me.departmentName}</p>
                ) : (
                  <p className="mt-0.5 truncate text-xs text-slate-400">부서 미지정</p>
                )}
                <p className="mt-1 truncate text-xs text-slate-400">{me?.email ?? ""}</p>
                {(me?.secondaryDepartments?.length ?? 0) > 0 ? (
                  <details className="mt-2 text-xs text-slate-500">
                    <summary className="cursor-pointer text-slate-500 hover:text-slate-700">
                      겸임 {me?.secondaryDepartments?.length}개
                    </summary>
                    <div className="mt-1 space-y-0.5">
                      {me?.secondaryDepartments?.map((d) => (
                        <p key={d.departmentId} className="truncate">
                          {d.departmentName}
                        </p>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Link
                href="/account/password"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                비밀번호 변경
              </Link>
              <button
                type="button"
                onClick={() => void handleLogout()}
                disabled={logoutBusy}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                {logoutBusy ? "로그아웃 중…" : "로그아웃"}
              </button>
            </div>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#FAFAF8]">
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200/80 bg-white px-8 py-4 shadow-sm">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{pageTitle}</h1>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700"
              >
                글로벌 검색
              </button>
              <button
                type="button"
                onClick={() => setQuickAddOpen(true)}
                className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
              >
                빠른추가
              </button>
            </div>
          </header>

          <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-8">{children}</main>
        </div>
      </div>

      <GlobalSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <QuickAddModal open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
      <NotificationSettingsModal
        open={notificationSettingsOpen}
        onClose={() => setNotificationSettingsOpen(false)}
      />
    </div>
  );
}
