"use client";

import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import Link from "next/link";
import { fetchJson } from "@/lib/fetch-json";

type DashboardSummary = {
  recentModifiedDocuments: Array<{
    id: string;
    title: string;
    workspaceId: string;
    workspaceName: string;
    modifiedAt: string;
  }>;
  todayTasks: Array<{ id: string; title: string; dueDate: string | null; status: string }>;
  todayEvents: Array<{ id: string; title: string; startsAt: string; kind: string }>;
  recentActivities: Array<{
    id: string;
    userName: string;
    entityName: string;
    actionType: string;
    createdAt: string;
  }>;
};

export function DashboardWorkspace() {
  const ACTION_TEXT: Record<string, string> = {
    message_sent: "메시지를 보냈습니다",
    task_created: "태스크를 생성했습니다",
    task_moved: "태스크를 이동했습니다",
    task_completed: "태스크를 완료했습니다",
    note_created: "미팅노트를 작성했습니다",
    note_updated: "미팅노트를 수정했습니다",
    file_uploaded: "파일을 업로드했습니다",
    event_created: "일정을 등록했습니다",
    member_joined: "팀에 합류했습니다",
    document_viewed: "문서를 조회했습니다",
    document_created: "문서를 생성했습니다",
    document_updated: "문서를 수정했습니다",
    document_version_created: "문서 버전을 추가했습니다",
    document_approved: "문서를 승인했습니다",
    document_archived: "문서를 아카이브했습니다",
    workspace_member_role_changed: "워크스페이스 권한이 변경되었습니다"
  };
  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => fetchJson<DashboardSummary>("/api/dashboard/summary")
  });

  const data = summaryQuery.data;
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="card-brand rounded-2xl p-5 lg:col-span-3">
        <h2 className="text-lg font-semibold text-slate-900">아카이브 · 최근 수정 문서</h2>
        <ul className="mt-4 space-y-2">
          {(data?.recentModifiedDocuments ?? []).map((d) => (
            <li key={d.id}>
              <Link
                href={`/archive/${d.workspaceId}/${d.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm hover:bg-slate-100"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{d.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{d.workspaceName}</p>
                </div>
                <span className="shrink-0 text-xs text-slate-400">
                  {dayjs(d.modifiedAt).format("MM-DD HH:mm")}
                </span>
              </Link>
            </li>
          ))}
          {!summaryQuery.isLoading && (data?.recentModifiedDocuments?.length ?? 0) === 0 && (
            <li className="text-sm text-slate-500">최근 수정된 문서가 없습니다.</li>
          )}
        </ul>
      </section>

      <section className="card-brand rounded-2xl p-5">
        <h2 className="text-lg font-semibold text-slate-900">오늘의 태스크</h2>
        <ul className="mt-4 space-y-3">
          {(data?.todayTasks ?? []).map((task) => (
            <li key={task.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-medium">{task.title}</p>
              <p className="mt-1 text-xs text-slate-500">
                마감 {task.dueDate ? dayjs(task.dueDate).format("HH:mm") : "-"} · 상태 {task.status}
              </p>
            </li>
          ))}
          {!summaryQuery.isLoading && (data?.todayTasks.length ?? 0) === 0 && (
            <li className="text-sm text-slate-500">오늘 마감 태스크가 없습니다.</li>
          )}
        </ul>
      </section>

      <section className="card-brand rounded-2xl p-5">
        <h2 className="text-lg font-semibold text-slate-900">오늘 일정</h2>
        <ul className="mt-4 space-y-3">
          {(data?.todayEvents ?? []).map((item) => (
            <li key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-medium">{item.title}</p>
              <p className="mt-1 text-xs text-slate-500">
                {dayjs(item.startsAt).format("HH:mm")} · {item.kind}
              </p>
            </li>
          ))}
          {!summaryQuery.isLoading && (data?.todayEvents.length ?? 0) === 0 && (
            <li className="text-sm text-slate-500">오늘 일정이 없습니다.</li>
          )}
        </ul>
      </section>

      <section className="card-brand rounded-2xl p-5">
        <h2 className="text-lg font-semibold text-slate-900">최근 활동</h2>
        <ul className="mt-4 space-y-3">
          {(data?.recentActivities ?? []).map((activity) => (
            <li key={activity.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <p>
                {activity.userName} · {ACTION_TEXT[activity.actionType] ?? activity.actionType}
              </p>
              <p className="mt-1 text-slate-600">{activity.entityName}</p>
            </li>
          ))}
          {!summaryQuery.isLoading && (data?.recentActivities.length ?? 0) === 0 && (
            <li className="text-sm text-slate-500">최근 활동이 없습니다.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
