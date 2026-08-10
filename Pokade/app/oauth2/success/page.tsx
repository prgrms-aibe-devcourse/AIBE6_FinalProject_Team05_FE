"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";

export default function OAuth2SuccessPage() {
  const router = useRouter();
  const restoreSession = useUserStore((s) => s.restoreSession);

  useEffect(() => {
    (async () => {
      const ok = await restoreSession(); // refresh 쿠키로 access 획득 + 프로필 + 로그인 상태
      router.replace(ok ? "/" : "/login?error=session_restore_failed"); // 성공만 홈, 실패는 로그인
    })();
  }, [restoreSession, router]);

  return <div className="mx-auto mt-24 text-center text-[15px] text-[#6E6E76]">로그인 중...</div>;
}
