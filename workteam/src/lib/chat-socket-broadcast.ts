type BroadcastFn = (channelId: string, event: string, payload: unknown) => void;

/** `server.mjs`가 런타임에 `globalThis.__chatIoBroadcast`에 연결. 미설정이면 no-op. */
export function broadcastToChatChannel(channelId: string, event: string, payload: unknown) {
  const fn = (globalThis as unknown as { __chatIoBroadcast?: BroadcastFn }).__chatIoBroadcast;
  try {
    fn?.(channelId, event, payload);
  } catch {
    void 0;
  }
}
