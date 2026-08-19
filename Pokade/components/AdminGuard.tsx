"use client";

import { useRequireAuth } from "@/hooks/useRequireAuth";

// /admin/* 전체를 감싸는 역할 가드. 페이지마다 호출하지 않고 레이아웃에 두는 이유는
// 새 관리자 페이지가 가드를 빠뜨릴 수 있고(실제로 /admin/reports가 그랬다),
// 인가 전에 children을 렌더하면 403이 뻔한 관리자 API 요청이 먼저 나가기 때문이다.
export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const status = useRequireAuth({ role: "admin" });

  // 리다이렉트가 도는 동안 관리자 화면이 한 프레임이라도 비쳐선 안 된다.
  if (status !== "authenticated") {
    return (
      <main className="main-content flex items-center justify-center bg-neutral">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#E7E7EB] border-t-primary" />
      </main>
    );
  }

  return <>{children}</>;
}
