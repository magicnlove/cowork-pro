export function getOnlineUserIds(): string[] {
  const getter = (globalThis as unknown as { __activityIoOnlineUserIds?: () => string[] })
    .__activityIoOnlineUserIds;
  try {
    return getter?.() ?? [];
  } catch {
    return [];
  }
}

