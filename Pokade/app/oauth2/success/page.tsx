"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";

export default function OAuth2SuccessPage() {
  const router = useRouter();
  const restoreSession = useUserStore((s) => s.restoreSession);

  useEffect(() => {
    (async () => {
      await restoreSession(); // refresh 쿠키로 access 획득 + 프로필 + 로그인 상태
      router.replace("/"); // 완료 후 홈으로
    })();
  }, [restoreSession, router]);

  return <div className="mx-auto mt-24 text-center text-[15px] text-[#6E6E76]">로그인 중...</div>;
}
