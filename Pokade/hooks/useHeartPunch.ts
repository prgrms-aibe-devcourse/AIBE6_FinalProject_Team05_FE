"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// keyframes(heartPunch) 길이보다 살짝 길게 — 재생이 끝나기 전에 상태를 비우면 애니메이션이
// 중간에 잘린다. tailwind.config.ts의 heart-punch(280ms)와 함께 움직이는 값.
const PUNCH_CLEAR_MS = 320;

// 관심(하트) 등록 순간에만 재생되는 펀치 애니메이션의 트리거.
//
// CSS 애니메이션은 클래스가 계속 붙어 있으면 한 번만 재생된다 — 그래서 재생 대상 엘리먼트에
// key를 바꿔 리마운트시키는 방식으로 매번 다시 재생시킨다(연타해도 n이 계속 올라가므로
// 이전 재생이 끝나지 않아도 새로 시작된다).
//
// "등록"에만 쓰는 이유: 해제는 되돌리는 동작이라 축하하듯 튀어오르면 의미가 어긋난다.
// 또 클릭한 하트만 재생돼야 하므로 카드 id를 함께 들고 있는다 — 목록 화면에서 다른 카드의
// 하트까지 같이 튀는 것을 막는다. 초기 렌더에는 punch가 null이라, 이미 등록된 카드들이
// 화면에 뜨는 순간 한꺼번에 애니메이션이 도는 일도 없다.
export function useHeartPunch() {
  const [punch, setPunch] = useState<{ id: number; n: number } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // 재생이 끝나면 상태를 비운다 — 안 비우면 클래스가 계속 붙어 있어서, 나중에 목록이
  // 재정렬되는 등으로 그 엘리먼트가 리마운트될 때 누르지도 않은 하트가 튀어오른다.
  const triggerPunch = useCallback((id: number) => {
    setPunch((prev) => ({ id, n: prev && prev.id === id ? prev.n + 1 : 1 }));
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setPunch(null), PUNCH_CLEAR_MS);
  }, []);

  // key와 className을 따로 돌려준다 — 한 객체로 묶어 {...spread} 하면 React가 key를 props로
  // 취급해 "key prop is being spread into JSX" 경고를 내고 리마운트도 일어나지 않는다.
  const punchKey = useCallback(
    (id: number) => (punch?.id === id ? `punch-${punch.n}` : "idle"),
    [punch],
  );

  // motion-safe: prefers-reduced-motion을 켠 사용자에게는 클래스 자체가 적용되지 않는다.
  const punchClass = useCallback(
    (id: number) => (punch?.id === id ? "motion-safe:animate-heart-punch" : ""),
    [punch],
  );

  return { triggerPunch, punchKey, punchClass };
}
