"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import dayjs from "dayjs";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import {
  PRIORITY_LABEL,
  TASK_STATUSES,
  type Task,
  type TaskPriority,
  type TaskStatus
} from "@/types/tasks";

function groupByStatus(tasks: Task[]): Record<TaskStatus, Task[]> {
  const base: Record<TaskStatus, Task[]> = {
    backlog: [],
    in_progress: [],
    in_review: [],
    done: []
  };
  for (const t of tasks) {
    base[t.status].push(t);
  }
  for (const s of TASK_STATUSES) {
    base[s.id].sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
  }
  return base;
}

function priorityAccent(p: TaskPriority) {
  switch (p) {
    case "high":
      return "border-l-[3px] border-l-red-500";
    case "medium":
      return "border-l-[3px] border-l-amber-400";
    default:
      return "border-l-[3px] border-l-emerald-500";
  }
}

function TaskCardVisual({ task }: { task: Task }) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 flex-1 text-sm font-semibold leading-snug text-slate-900">{task.title}</p>
        {task.isNew ? (
          <span className="shrink-0 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-rose-800">
            New
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
        {task.assigneeName && (
          <span className="inline-flex max-w-[140px] items-center truncate rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700">
            {task.assigneeName}
          </span>
        )}
        <span
          className={clsx(
            "rounded px-1.5 py-0.5 font-medium",
            task.priority === "high" && "bg-red-50 text-red-700",
            task.priority === "medium" && "bg-amber-50 text-amber-800",
            task.priority === "low" && "bg-emerald-50 text-emerald-800"
          )}
        >
          {PRIORITY_LABEL[task.priority]}
        </span>
        {task.dueDate && (
          <span className="text-slate-500">{dayjs(task.dueDate).format("M/D")}</span>
        )}
      </div>
      {task.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.tags.map((tag) => (
            <span
              key={tag}
              className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide text-slate-600"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

function SortableTaskCard({ task, onOpen }: { task: Task; onOpen: (task: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={clsx(
        "flex w-full gap-1 rounded-lg border border-slate-200/90 bg-white py-2 pl-1 pr-2 shadow-sm ring-1 ring-black/[0.04] transition hover:shadow-md",
        priorityAccent(task.priority),
        isDragging && "opacity-40"
      )}
    >
      <button
        type="button"
        className="mt-0.5 flex h-7 w-6 shrink-0 cursor-grab touch-none items-start justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing"
        aria-label="카드 이동"
        {...listeners}
      >
        <span className="text-base leading-none">⋮⋮</span>
      </button>
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={() => onOpen(task)}
      >
        <TaskCardVisual task={task} />
      </button>
    </div>
  );
}

function KanbanColumn({
  status,
  label,
  tasks,
  onOpen
}: {
  status: TaskStatus;
  label: string;
  tasks: Task[];
  onOpen: (task: Task) => void;
}) {
  const colId = `col-${status}` as const;
  const { setNodeRef, isOver } = useDroppable({ id: colId });

  return (
    <div className="flex max-h-[min(72vh,calc(100vh-220px))] min-w-[272px] max-w-[320px] flex-1 flex-col rounded-xl border border-slate-200/80 bg-[#F2F1EF] shadow-inner">
      <div className="flex shrink-0 items-center justify-between px-3 py-2.5">
        <h3 className="text-sm font-semibold text-slate-800">{label}</h3>
        <span className="rounded-full bg-slate-300/60 px-2 py-0.5 text-xs font-semibold text-slate-700">
          {tasks.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={clsx(
          "mx-2 mb-2 flex min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto rounded-lg px-1 py-1",
          isOver && "bg-brand-50/40 ring-2 ring-brand-200/80"
        )}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <SortableTaskCard key={task.id} task={task} onOpen={onOpen} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

type TasksKanbanProps = {
  tasks: Task[];
  onMove: (taskId: string, status: TaskStatus, index: number) => Promise<void>;
  onCardClick: (task: Task) => void;
};

export function TasksKanban({ tasks, onMove, onCardClick }: TasksKanbanProps) {
  const grouped = useMemo(() => groupByStatus(tasks), [tasks]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    })
  );

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) ?? null : null;

  function findColumnByTaskId(taskId: string): TaskStatus | null {
    for (const s of TASK_STATUSES) {
      if (grouped[s.id].some((t) => t.id === taskId)) return s.id;
    }
    return null;
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeIdStr = String(active.id);
    const overId = String(over.id);

    const fromCol = findColumnByTaskId(activeIdStr);
    if (!fromCol) return;

    let toCol: TaskStatus;
    let toIndex: number;

    if (overId.startsWith("col-")) {
      toCol = overId.slice(4) as TaskStatus;
      toIndex = grouped[toCol].length;
    } else {
      const oc = findColumnByTaskId(overId);
      if (!oc) return;
      toCol = oc;
      toIndex = grouped[toCol].findIndex((t) => t.id === overId);
      if (toIndex < 0) return;
    }

    const fromList = grouped[fromCol];
    const oldIndex = fromList.findIndex((t) => t.id === activeIdStr);
    if (oldIndex < 0) return;

    if (fromCol === toCol) {
      if (overId.startsWith("col-")) {
        toIndex = Math.max(0, fromList.length - 1);
      }
      if (oldIndex === toIndex) return;
      const newOrder = arrayMove(fromList, oldIndex, toIndex);
      const finalIndex = newOrder.findIndex((t) => t.id === activeIdStr);
      await onMove(activeIdStr, fromCol, finalIndex);
      return;
    }

    if (overId.startsWith("col-")) {
      toIndex = grouped[toCol].length;
    }

    await onMove(activeIdStr, toCol, toIndex);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-2">
        {TASK_STATUSES.map(({ id, label }) => (
          <KanbanColumn key={id} status={id} label={label} tasks={grouped[id]} onOpen={onCardClick} />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div className="w-[280px] rotate-1 scale-[1.02] cursor-grabbing shadow-xl">
            <div
              className={clsx(
                "rounded-lg border border-slate-200/90 bg-white px-3 py-2.5 shadow-sm ring-1 ring-black/[0.04]",
                priorityAccent(activeTask.priority)
              )}
            >
              <TaskCardVisual task={activeTask} />
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
