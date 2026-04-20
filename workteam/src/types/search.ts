export type GlobalSearchType = "all" | "chat" | "task" | "note" | "event" | "file";

export type GlobalSearchCategory = "chat" | "task" | "note" | "event" | "file";

export type GlobalSearchItemDTO = {
  category: GlobalSearchCategory;
  id: string;
  title: string;
  snippet: string | null;
  departmentId: string | null;
  departmentName: string | null;
  occurredAt: string;
  link: string;
};

