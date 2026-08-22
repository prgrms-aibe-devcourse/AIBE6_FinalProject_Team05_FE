"use client";

import { useEffect, useState } from "react";

// 상대시간 표시("방금 전"/"N분 전")를 스스로 최신으로 유지하기 위해 1분마다 리렌더를 유발하는 훅.
// formatNotifTime(lib/notificationDisplay.tsx)은 렌더 시점 기준으로 계산되므로, 화면을 열어둔 채
// 시간이 흐르면 값이 굳는다 — 이 훅이 주기적으로 리렌더를 일으켜 다시 계산되게 한다.
// 반환값은 없다: tick 상태가 바뀌며 리렌더가 일어나는 것 자체가 목적이다.
//
// enabled=false면 타이머를 걸지 않는다 — 헤더 알림 드롭다운처럼 "열려 있을 때만" 상대시간이
// 보이는 곳에서 닫힌 동안 불필요한 리렌더를 막는 데 쓴다. SSE/폴링과 무관하게 독립적으로 돈다.
export function useMinuteTick(enabled = true): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, [enabled]);
}
