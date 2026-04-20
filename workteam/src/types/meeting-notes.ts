export type NoteBlockType = "heading" | "paragraph" | "checklist" | "divider";

export type ChecklistItem = {
  id: string;
  text: string;
  checked: boolean;
};

export type NoteBlockDTO = {
  id: string;
  type: NoteBlockType;
  body: string | null;
  checklistItems: ChecklistItem[] | null;
  sortOrder: number;
};

export type MeetingNoteListItemDTO = {
  id: string;
  title: string;
  departmentId: string;
  departmentName: string;
  updatedAt: string;
  createdAt: string;
};

export type MeetingNoteDetailDTO = {
  id: string;
  title: string;
  departmentId: string;
  departmentName: string;
  attendeeUserIds: string[];
  attendees: { id: string; name: string; email: string }[];
  blocks: NoteBlockDTO[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};
