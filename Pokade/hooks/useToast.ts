"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// 화면 하단에 잠깐 떴다 사라지는 알림(components/Toast.tsx)의 상태·타이머 담당.
// 홈/마켓/카드상세 세 곳이 각자 같은 setTimeout 코드를 복붙해 쓰고 있었고(#235), 그 구현엔
// 언마운트 시 타이머 정리가 없어 토스트가 떠 있는 채로 페이지를 벗어나면 사라진 컴포넌트에
// setState가 걸렸다 — useTimedFlag와 같은 방식으로 ref에 타이머를 들고 cleanup에서 지운다.
//
// durationMs를 show() 인자로 받는 이유: 같은 화면에서도 토스트마다 필요한 시간이 다르다.
// 관심 "등록" 토스트는 눌러서 관심 목록으로 갈 수 있어 여유가 필요하고(4초), 단순 알림인
// "해제"는 기존처럼 짧게(2.5초) 두는 게 방해되지 않는다.
export interface ToastState {
  message: string;
  // 지정하면 토스트가 링크로 바뀐다(Toast.tsx가 이 값으로 클릭 가능 여부를 판단).
  href?: string;
  // 링크일 때 메시지 오른쪽에 붙는 짧은 라벨(예: "관심 목록").
  linkLabel?: string;
}

export const TOAST_DEFAULT_MS = 2500;

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // 연속 호출(하트를 빠르게 여러 번 클릭)에서는 이전 타이머를 취소하고 다시 재서, 먼저 걸린
  // 타이머가 방금 띄운 토스트를 앞당겨 지우지 않게 한다.
  const showToast = useCallback((next: ToastState, durationMs: number = TOAST_DEFAULT_MS) => {
    setToast(next);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setToast(null), durationMs);
  }, []);

  const hideToast = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setToast(null);
  }, []);

  return { toast, showToast, hideToast };
}
