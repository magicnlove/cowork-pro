import { fetchJson } from "@/lib/fetch-json";

/**
 * 전역 네비 배지 읽음. DB `user_badge_reads.badge_type`과 대응한다.
 * `activity`는 **액티비티 피드(`/activity-feed`)** 방문 시에만 갱신한다.
 * 대시보드「최근 활동」은 같은 `activity_logs`를 일부 보여 줄 뿐, 이 포인터와는 별개다.
 */
export type NavBadgeReadType = "tasks" | "calendar" | "notes" | "activity";

export async function markNavBadgeRead(type: NavBadgeReadType): Promise<void> {
  await fetchJson<{ ok: boolean }>("/api/nav/badges/read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type })
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("nav-badges:refresh"));
  }
}

/** 액티비티 피드 페이지에서만 호출. 대시보드 요약에서는 호출하지 않는다. */
export async function markActivityFeedNavBadgeRead(): Promise<void> {
  await markNavBadgeRead("activity");
}

/** 담당 태스크 네비 배지: 해당 태스크만 읽음 처리 (전역 tasks 배지와 무관) */
export async function markTaskRead(taskId: string): Promise<void> {
  await fetchJson<{ ok: boolean }>(`/api/tasks/${taskId}/read`, {
    method: "POST"
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("nav-badges:refresh"));
  }
}
