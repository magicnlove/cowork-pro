"use client";

import dayjs from "dayjs";
import { useEffect, useRef } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { getNotificationPrefs } from "@/lib/notification-preferences";
import type { CalendarEvent } from "@/types/calendar";

function notifIconUrl() {
  return new URL("/logo.png", window.location.origin).href;
}

export function useCalendarReminders(active: boolean) {
  const firedSessionRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!active || typeof window === "undefined") {
      return;
    }

    function tick() {
      const prefs = getNotificationPrefs();
      if (!prefs.event) {
        return;
      }
      if (typeof Notification === "undefined" || Notification.permission !== "granted") {
        return;
      }
      if (document.hasFocus()) {
        return;
      }

      const from = dayjs().format("YYYY-MM-DD");
      const to = from;
      void (async () => {
        try {
          const { events } = await fetchJson<{ events: CalendarEvent[] }>(
            `/api/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
          );
          const now = Date.now();
          for (const ev of events) {
            const dayKey = dayjs(ev.startsAt).format("YYYY-MM-DD");
            const sk = `cal:${ev.id}:${dayKey}`;
            if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(sk)) {
              continue;
            }
            const start = new Date(ev.startsAt).getTime();
            const remindAt = start - 30 * 60 * 1000;
            if (now < remindAt || now >= remindAt + 120_000) {
              continue;
            }
            if (firedSessionRef.current.has(sk)) {
              continue;
            }
            firedSessionRef.current.add(sk);
            if (typeof sessionStorage !== "undefined") {
              sessionStorage.setItem(sk, "1");
            }
            const n = new Notification("30분 후 일정", {
              body: ev.title,
              icon: notifIconUrl(),
              tag: sk
            });
            n.onclick = () => {
              window.focus();
              window.location.href = "/calendar";
              n.close();
            };
          }
        } catch {
          void 0;
        }
      })();
    }

    tick();
    const id = window.setInterval(tick, 15_000);
    return () => window.clearInterval(id);
  }, [active]);
}
