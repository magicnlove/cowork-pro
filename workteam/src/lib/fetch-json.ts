/**
 * 브라우저에서 API 호출 시 credentials 포함.
 * 401이면 로그인 페이지(/)로 이동 (로그인 API 등 skipAuthRedirect 로 제외).
 */

export type FetchJsonInit = RequestInit & {
  skipAuthRedirect?: boolean;
};

export async function fetchJson<T>(url: string, init?: FetchJsonInit): Promise<T> {
  const { skipAuthRedirect, ...rest } = init ?? {};
  const method = String(rest.method ?? "GET").toUpperCase();
  const res = await fetch(url, {
    ...rest,
    credentials: rest.credentials ?? "include",
    cache: rest.cache ?? (method === "GET" ? "no-store" : undefined)
  });

  const data = (await res.json().catch(() => ({}))) as { message?: string };

  if (res.status === 401) {
    if (typeof window !== "undefined" && !skipAuthRedirect && window.location.pathname !== "/") {
      window.location.assign("/");
    }
    throw new Error(data.message ?? "로그인이 필요합니다.");
  }

  if (!res.ok) {
    throw new Error(data.message ?? res.statusText);
  }

  return data as T;
}
