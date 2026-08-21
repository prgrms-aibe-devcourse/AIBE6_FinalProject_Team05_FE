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
  // 자동 소멸까지 남은 시간과 현재 타이머가 시작된 시각 — 일시정지 후 "처음부터"가 아니라
  // "남은 만큼"만 재개하기 위해 필요하다(4초짜리 토스트를 3.9초쯤 hover했다가 벗어났는데
  // 다시 4초를 기다리게 하면, 붙잡을 의도가 없던 스침에도 토스트가 계속 살아남는다).
  const remainingRef = useRef(TOAST_DEFAULT_MS);
  const startedAtRef = useRef(0);
  // hover/focus가 토스트 "안에 있는 동안" true. 일시정지 여부를 이 플래그로 따로 들고 있는
  // 이유: 토스트가 떠 있는 상태에서 새 토스트를 띄우면(하트 연타) 같은 DOM 노드가 재사용돼
  // mouseenter가 다시 발생하지 않는다 — 이 플래그가 없으면 마우스를 올려둔 채로도 새 토스트가
  // 그냥 사라진다.
  const heldRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startTimer = useCallback(
    (durationMs: number) => {
      clearTimer();
      remainingRef.current = durationMs;
      startedAtRef.current = Date.now();
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        setToast(null);
      }, durationMs);
    },
    [clearTimer],
  );

  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  // 토스트가 사라지면 붙잡힘 상태도 반드시 푼다 — 마우스를 올려둔 채 토스트가 DOM에서
  // 제거되면 브라우저가 mouseleave를 쏘지 않아 heldRef가 true로 굳고, 그 뒤 뜨는 토스트가
  // 영영 안 사라지게 된다.
  useEffect(() => {
    if (toast === null) heldRef.current = false;
  }, [toast]);

  // 연속 호출(하트를 빠르게 여러 번 클릭)에서는 이전 타이머를 취소하고 다시 재서, 먼저 걸린
  // 타이머가 방금 띄운 토스트를 앞당겨 지우지 않게 한다.
  const showToast = useCallback(
    (next: ToastState, durationMs: number = TOAST_DEFAULT_MS) => {
      setToast(next);
      if (heldRef.current) {
        // 이미 붙잡혀 있으면 타이머를 걸지 않고 남은 시간만 새 값으로 맞춰둔다 —
        // 벗어나는 순간(resumeToast) 이 값으로 시작한다.
        clearTimer();
        remainingRef.current = durationMs;
        return;
      }
      startTimer(durationMs);
    },
    [clearTimer, startTimer],
  );

  // hover/focus가 들어온 순간 — 남은 시간을 계산해 붙들어 둔다.
  const pauseToast = useCallback(() => {
    heldRef.current = true;
    if (timeoutRef.current == null) return; // 이미 멈춰 있음
    clearTimer();
    remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAtRef.current));
  }, [clearTimer]);

  // hover/focus가 빠져나간 순간 — 남은 시간만큼만 다시 센다.
  const resumeToast = useCallback(() => {
    heldRef.current = false;
    if (timeoutRef.current != null) return; // 이미 돌고 있음
    startTimer(remainingRef.current > 0 ? remainingRef.current : TOAST_DEFAULT_MS);
  }, [startTimer]);

  const hideToast = useCallback(() => {
    clearTimer();
    heldRef.current = false;
    setToast(null);
  }, [clearTimer]);

  return { toast, showToast, hideToast, pauseToast, resumeToast };
}
