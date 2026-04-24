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
   * 목록에 보이는 태스크 중 미완료이며, 현재 사용자 기준 읽음(user_task_reads)이 없거나
   * 마지막 읽은 뒤 수정된 경우(다시 새로 취급). 타인이 만든 공통 업무도 동일합니다.
   * 상세를 열면 markTaskRead로 읽음 처리되어 false로 갱신될 수 있습니다.
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
