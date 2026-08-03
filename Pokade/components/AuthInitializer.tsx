"use client";

import { useEffect } from "react";
import { useUserStore } from "@/store/useUserStore";

// 앱 첫 로드 시 refresh 쿠키로 세션 복원 시도 (렌더링은 없음)
export default function AuthInitializer() {
  const restoreSession = useUserStore((s) => s.restoreSession);
  useEffect(() => {
    restoreSession();
  }, [restoreSession]);
  return null;
}
