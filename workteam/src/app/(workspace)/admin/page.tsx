import { Suspense } from "react";
import { AdminWorkspace } from "@/components/admin/admin-workspace";

export default function AdminPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">불러오는 중…</p>}>
      <AdminWorkspace />
    </Suspense>
  );
}
