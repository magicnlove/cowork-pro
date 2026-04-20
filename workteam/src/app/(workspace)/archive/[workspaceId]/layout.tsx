import { ReactNode } from "react";
import { ArchiveWorkspaceShell } from "@/components/archive/archive-workspace-shell";

export default function ArchiveWorkspaceLayout({
  children,
  params
}: {
  children: ReactNode;
  params: { workspaceId: string };
}) {
  return (
    <section className="card-brand min-h-0 flex-1 rounded-2xl p-6">
      <ArchiveWorkspaceShell workspaceId={params.workspaceId}>{children}</ArchiveWorkspaceShell>
    </section>
  );
}
