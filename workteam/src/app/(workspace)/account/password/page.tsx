"use client";

import { useRouter } from "next/navigation";
import { PasswordChangePanel } from "@/components/auth/password-change-panel";

export default function AccountPasswordPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-0 flex-1 justify-center overflow-auto py-4">
      <PasswordChangePanel
        variant="account"
        onSuccess={() => {
          window.alert("비밀번호가 변경되었습니다.");
          router.push("/dashboard");
        }}
      />
    </div>
  );
}
