export type TaskStatus = "backlog" | "in_progress" | "in_review" | "done";

export type TaskPriority = "high" | "medium" | "low";

export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  assigneeUserId: string | null;
  assigneeName: string | null;
  tags: string[];
  position: number;
  departmentId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  /**
   * 현재 사용자가 담당이고 미완료일 때, 아직 읽지 않았거나 수정 후 다시 '새'로 취급되는 경우.
   * 담당이 아니면 항상 false에 가깝게 내려옵니다.
   */
  isNew?: boolean;
};

export type UserOption = {
  id: string;
  name: string;
  email: string;
  departmentId?: string | null;
  departmentName?: string | null;
  departmentPath?: string | null;
};

export const TASK_STATUSES: { id: TaskStatus; label: string }[] = [
  { id: "backlog", label: "백로그" },
  { id: "in_progress", label: "진행중" },
  { id: "in_review", label: "검토중" },
  { id: "done", label: "완료" }
];

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  high: "높음",
  medium: "중간",
  low: "낮음"
};
