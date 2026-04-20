const P = "app:notifications:";

export type NotificationPrefKey = "chat" | "task" | "event" | "archive";

export function getNotificationPrefs(): Record<NotificationPrefKey, boolean> {
  if (typeof window === "undefined") {
    return { chat: true, task: true, event: true, archive: true };
  }
  return {
    chat: window.localStorage.getItem(`${P}chat`) !== "off",
    task: window.localStorage.getItem(`${P}task`) !== "off",
    event: window.localStorage.getItem(`${P}event`) !== "off",
    archive: window.localStorage.getItem(`${P}archive`) !== "off"
  };
}

export function setNotificationPref(key: NotificationPrefKey, enabled: boolean) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(`${P}${key}`, enabled ? "on" : "off");
}

export function hasPromptedForNotifications(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  return window.localStorage.getItem(`${P}permissionAsked`) === "1";
}

export function markNotificationsPermissionAsked() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(`${P}permissionAsked`, "1");
}
