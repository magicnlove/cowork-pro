import { ArchiveDocumentDetail } from "@/components/archive/archive-document-detail";

export default function ArchiveDocumentPage({
  params
}: {
  params: { workspaceId: string; documentId: string };
}) {
  return (
    <ArchiveDocumentDetail workspaceId={params.workspaceId} documentId={params.documentId} />
  );
}
