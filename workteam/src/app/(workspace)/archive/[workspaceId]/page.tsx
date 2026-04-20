import { ArchiveWorkspaceMembersPanel } from "@/components/archive/archive-workspace-members";

export default function ArchiveWorkspaceHomePage({ params }: { params: { workspaceId: string } }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        왼쪽에서 폴더를 고르고 문서를 선택하세요. 새 문서는 &quot;새 문서&quot;로 만들 수 있습니다.
      </p>
      <ArchiveWorkspaceMembersPanel workspaceId={params.workspaceId} />
    </div>
  );
}
