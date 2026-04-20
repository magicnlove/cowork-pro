export type CalendarKind = "personal" | "team" | "announcement";

export type CalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  kind: CalendarKind;
  departmentId: string | null;
  attendeeUserIds: string[];
  attendees: { id: string; name: string; email: string }[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export const KIND_LABEL: Record<CalendarKind, string> = {
  personal: "개인",
  team: "팀",
  announcement: "공지"
};

export type CalendarViewMode = "month" | "week" | "day";
