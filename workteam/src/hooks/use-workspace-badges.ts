"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { fetchJson } from "@/lib/fetch-json";
import {
  getNotificationPrefs,
  hasPromptedForNotifications,
  markNotificationsPermissionAsked
} from "@/lib/notification-preferences";

export type NavBadgeCounts = {
  chatUnread: number;
  tasksMineOpen: number;
  calendarTodayRemaining: number;
  meetingNotesNew: number;
  activityNew: number;
};

type ChatNotifyPayload = {
  channelId: string;
  channelDisplayName?: string;
  senderName?: string;
  bodyPreview?: string;
  authorUserId: string;
  messageId: string;
};

function badgeUrl() {
  return new URL("/logo.png", window.location.origin).href;
}

export function useWorkspaceBadges(meId: string | null) {
  const pathname = usePathname();
  const [counts, setCounts] = useState<NavBadgeCounts>({
    chatUnread: 0,
    tasksMineOpen: 0,
    calendarTodayRemaining: 0,
    meetingNotesNew: 0,
    activityNew: 0
  });

  const loadBadges = useCallback(async () => {
    const data = await fetchJson<NavBadgeCounts>("/api/nav/badges");
    setCounts(data);
  }, []);

  const loadRef = useRef(loadBadges);
  loadRef.current = loadBadges;

  useEffect(() => {
    if (!meId) {
      return;
    }
    void loadBadges();
  }, [meId, pathname, loadBadges]);

  useEffect(() => {
    function onRefresh() {
      void loadRef.current();
    }
    window.addEventListener("nav-badges:refresh", onRefresh);
    return () => window.removeEventListener("nav-badges:refresh", onRefresh);
  }, []);

  useEffect(() => {
    function onFocus() {
      void loadRef.current();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    if (!meId || typeof window === "undefined") {
      return;
    }
    if (!hasPromptedForNotifications() && typeof Notification !== "undefined") {
      if (Notification.permission === "default") {
        void Notification.requestPermission().finally(() => {
          markNotificationsPermissionAsked();
        });
      } else {
        markNotificationsPermissionAsked();
      }
    }
  }, [meId]);

  useEffect(() => {
    if (!meId) {
      return;
    }
    const socket: Socket = io({
      path: "/socket.io/",
      withCredentials: true,
      transports: ["websocket", "polling"]
    });

    function refetch() {
      void loadRef.current();
    }

    function onChatNotify(p: ChatNotifyPayload) {
      if (!p?.authorUserId || p.authorUserId === meId) {
        return;
      }
      const prefs = getNotificationPrefs();
      if (!prefs.chat) {
        return;
      }
      if (typeof Notification === "undefined" || Notification.permission !== "granted") {
        return;
      }
      if (document.hasFocus()) {
        return;
      }
      const chName = p.channelDisplayName ?? "채팅";
      const preview = String(p.bodyPreview ?? "")
        .replace(/\u200b/g, "")
        .trim()
        .slice(0, 50);
      const line = `${chName}  ${p.senderName ?? ""}: ${preview}`.trim();
      const n = new Notification(line || chName, {
        icon: badgeUrl(),
        tag: `chat:${p.messageId}`
      });
      n.onclick = () => {
        window.focus();
        window.location.href = `/chat?channelId=${encodeURIComponent(p.channelId)}`;
        n.close();
      };
    }

    function onTaskAssigned(p: { taskId?: string; title?: string }) {
      if (!p?.title) {
        return;
      }
      const prefs = getNotificationPrefs();
      if (!prefs.task) {
        return;
      }
      if (typeof Notification === "undefined" || Notification.permission !== "granted") {
        return;
      }
      if (document.hasFocus()) {
        return;
      }
      const n = new Notification("새 태스크가 배정되었습니다", {
        body: p.title,
        icon: badgeUrl(),
        tag: `task:${p.taskId ?? p.title}`
      });
      n.onclick = () => {
        window.focus();
        window.location.href = "/tasks";
        n.close();
      };
    }

    function onDocumentMention(p: {
      documentId?: string;
      workspaceId?: string;
      title?: string;
      fromName?: string;
    }) {
      if (!p?.documentId || !p.workspaceId) {
        return;
      }
      const prefs = getNotificationPrefs();
      if (!prefs.archive) {
        return;
      }
      if (typeof Notification === "undefined" || Notification.permission !== "granted") {
        return;
      }
      if (document.hasFocus()) {
        return;
      }
      const n = new Notification("문서에서 멘션되었습니다", {
        body: `${p.fromName ?? "사용자"} · ${p.title ?? "문서"}`,
        icon: badgeUrl(),
        tag: `doc:${p.documentId}`
      });
      n.onclick = () => {
        window.focus();
        window.location.href = `/archive/${p.workspaceId}/${p.documentId}`;
        n.close();
      };
    }

    socket.on("nav:badges", refetch);
    socket.on("activity:new", refetch);
    socket.on("chat:notify", onChatNotify);
    socket.on("task:assigned", onTaskAssigned);
    socket.on("document:mention", onDocumentMention);

    return () => {
      socket.removeAllListeners();
      socket.close();
    };
  }, [meId]);

  const display = useMemo(
    () => ({
      chat: counts.chatUnread,
      tasks: counts.tasksMineOpen,
      calendar: counts.calendarTodayRemaining,
      meetingNotes: counts.meetingNotesNew,
      activity: counts.activityNew
    }),
    [counts]
  );

  return { counts, display, reloadBadges: loadBadges };
}
