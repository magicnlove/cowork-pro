type ActivityBroadcastFn = (event: string, payload: unknown) => void;

export function broadcastActivityEvent(event: string, payload: unknown) {
  const fn = (globalThis as unknown as { __activityIoBroadcast?: ActivityBroadcastFn }).__activityIoBroadcast;
  try {
    fn?.(event, payload);
  } catch {
    void 0;
  }
}

export function broadcastNavBadgesRefresh() {
  broadcastActivityEvent("nav:badges", {});
}

export function broadcastChatNotify(payload: Record<string, unknown>) {
  broadcastActivityEvent("chat:notify", payload);
}

