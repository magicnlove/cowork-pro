import { MeetingNotesWorkspace } from "@/components/meeting-notes/meeting-notes-workspace";

export default function MeetingNotesPage() {
  return (
    <section className="space-y-3">
      <div className="px-1">
        <p className="mt-1 text-sm text-slate-600">
          미팅노트 부서별 접근 권한이 적용된 회의록입니다. 블록 편집·멘션·액션 아이템·파일을 사용할 수 있습니다.
        </p>
      </div>
      <MeetingNotesWorkspace />
    </section>
  );
}
