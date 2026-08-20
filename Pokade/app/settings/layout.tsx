"use client";

import SettingsNav from "@/components/SettingsNav";
import { useRequireAuth } from "@/hooks/useRequireAuth";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const status = useRequireAuth();

  // 로그인 확정 전에는 본문을 그리지 않는다 — 리다이렉트가 도는 동안 설정 화면이 비쳐선 안 된다.
  if (status !== "authenticated") {
    return (
      <main className="main-content flex items-center justify-center bg-neutral">
        <div role="status">
          <span
            aria-hidden="true"
            className="block h-8 w-8 animate-spin rounded-full border-[3px] border-[#E7E7EB] border-t-primary"
          />
          <span className="sr-only">불러오는 중</span>
        </div>
      </main>
    );
  }

  return (
    <main className="main-content bg-neutral px-10 py-12">
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6 md:flex-row md:gap-8">
        <SettingsNav />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </main>
  );
}
