"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// 화면 하단에 잠깐 떴다 사라지는 알림(components/Toast.tsx)의 상태·타이머 담당.
// 홈/마켓/카드상세 세 곳이 각자 같은 setTimeout 코드를 복붙해 쓰고 있었고(#235), 그 구현엔
// 언마운트 시 타이머 정리가 없어 토스트가 떠 있는 채로 페이지를 벗어나면 사라진 컴포넌트에
// setState가 걸렸다 — useTimedFlag와 같은 방식으로 ref에 타이머를 들고 cleanup에서 지운다.
//
// durationMs를 show() 인자로 받는 이유: 같은 화면에서도 토스트마다 필요한 시간이 다르다.
// 관심 "등록" 토스트는 눌러서 목표가를 설정하러 갈 수 있어 여유가 필요하고(4초), 단순 알림인
// "해제"는 기존처럼 짧게(2.5초) 두는 게 방해되지 않는다. 실패 토스트도 원인을 읽어야 하므로
// 등록과 같은 4초를 쓴다(lib/watchlistToast.ts).
export interface ToastState {
  message: string;
  // 지정하면 토스트가 링크로 바뀐다(Toast.tsx가 이 값으로 클릭 가능 여부를 판단).
  href?: string;
  // 링크일 때 메시지 오른쪽에 붙는 짧은 라벨(예: "목표가 설정하러 가기").
  linkLabel?: string;
  // 이동이 아니라 "방금 한 일을 되돌리기" 같은 동작이 필요할 때 쓴다(#238).
  // href와 동시에 지정하지 않는다 — Toast.tsx가 href를 먼저 보고 링크로 렌더한다.
  action?: { label: string; onClick: () => void };
  // 실패 알림이면 "error" — 배경색이 달라지고 스크린리더에 즉시(assertive) 읽힌다.
  // 성공·안내는 흘려들어도 되지만 실패는 "왜 안 됐는지"를 지금 알아야 하기 때문이다.
  // 생략하면 기존과 같은 안내 토스트로 렌더된다.
  tone?: "info" | "error";
}

// 토스트를 붙잡고 있는 주체. 포인터(hover)와 포커스(키보드)는 서로 독립적으로 들어오고
// 나가므로 어느 쪽이 들어왔는지/나갔는지를 구분해서 받는다.
export type ToastHoldSource = "pointer" | "focus";

export const TOAST_DEFAULT_MS = 2500;

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 자동 소멸까지 남은 시간과 현재 타이머가 시작된 시각 — 일시정지 후 "처음부터"가 아니라
  // "남은 만큼"만 재개하기 위해 필요하다(4초짜리 토스트를 3.9초쯤 hover했다가 벗어났는데
  // 다시 4초를 기다리게 하면, 붙잡을 의도가 없던 스침에도 토스트가 계속 살아남는다).
  //
  // null은 "진행 중인 카운트다운 없음"(토스트가 이미 사라졌거나 아직 뜬 적 없음)이고,
  // 0은 "시간을 정말 다 썼음"(만료)이다. 이 둘을 같은 값으로 두면 안 되는 이유(CodeRabbit 리뷰):
  // 타이머 만기 시각은 지났는데 콜백이 아직 실행되기 전에 pause가 끼어들 수 있다(브라우저가
  // 입력 이벤트를 만기된 타이머보다 먼저 처리하거나, 스로틀링·롱태스크로 콜백이 늦는 경우).
  // 그때 남은 시간은 정확히 0으로 계산되는데, 예전 코드는 이를 "값 없음"으로 보고 기본
  // 2.5초를 새로 얹었다 — 벗어나는 순간 사라져야 할 토스트가 오히려 더 오래 붙어 있었다.
  const remainingRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  // hover/focus가 토스트 "안에 있는 동안" true. 일시정지 여부를 플래그로 따로 들고 있는
  // 이유: 토스트가 떠 있는 상태에서 새 토스트를 띄우면(하트 연타) 같은 DOM 노드가 재사용돼
  // mouseenter가 다시 발생하지 않는다 — 이 플래그가 없으면 마우스를 올려둔 채로도 새 토스트가
  // 그냥 사라진다.
  //
  // 포인터와 포커스를 하나로 묶지 않고 축을 나눈 이유(CodeRabbit 리뷰): 마우스를 올린 채
  // Tab으로 안쪽 링크까지 들어간 상태에서 마우스만 벗어나면, 포커스는 아직 토스트 안에 있는데도
  // 단일 플래그는 false가 되어 타이머가 재개된다 — 링크를 읽거나 누르려던 사용자 눈앞에서
  // 토스트가 사라진다. 두 축을 따로 들고 "둘 다 벗어났을 때만" 재개한다.
  const pointerHeldRef = useRef(false);
  const focusHeldRef = useRef(false);

  const isHeld = useCallback(() => pointerHeldRef.current || focusHeldRef.current, []);

  const setHeld = useCallback((source: ToastHoldSource, held: boolean) => {
    if (source === "pointer") pointerHeldRef.current = held;
    else focusHeldRef.current = held;
  }, []);

  const releaseAllHolds = useCallback(() => {
    pointerHeldRef.current = false;
    focusHeldRef.current = false;
  }, []);

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
        remainingRef.current = null;
        setToast(null);
      }, durationMs);
    },
    [clearTimer],
  );

  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  // 토스트가 사라지면 카운트다운 상태를 전부 리셋한다. 붙잡힘 해제가 특히 중요한데,
  // 마우스를 올려둔 채(또는 포커스를 준 채) 토스트가 DOM에서 제거되면 브라우저가
  // mouseleave/blur를 쏘지 않아 플래그가 true로 굳고, 그 뒤 뜨는 토스트가 영영 안 사라진다.
  useEffect(() => {
    if (toast !== null) return;
    releaseAllHolds();
    remainingRef.current = null;
  }, [toast, releaseAllHolds]);

  // 연속 호출(하트를 빠르게 여러 번 클릭)에서는 이전 타이머를 취소하고 다시 재서, 먼저 걸린
  // 타이머가 방금 띄운 토스트를 앞당겨 지우지 않게 한다.
  const showToast = useCallback(
    (next: ToastState, durationMs: number = TOAST_DEFAULT_MS) => {
      setToast(next);
      if (isHeld()) {
        // 이미 붙잡혀 있으면 타이머를 걸지 않고 남은 시간만 새 값으로 맞춰둔다 —
        // 마지막 축까지 벗어나는 순간(resumeToast) 이 값으로 시작한다. 직전 토스트가 만료
        // 상태(0)로 붙잡혀 있었더라도 여기서 새 duration으로 덮이므로 되살아나지 않는다.
        clearTimer();
        remainingRef.current = durationMs;
        return;
      }
      startTimer(durationMs);
    },
    [clearTimer, isHeld, startTimer],
  );

  // hover/focus가 들어온 순간 — 남은 시간을 계산해 붙들어 둔다.
  // 계산 결과가 0이어도(=이미 만료됐어야 하는데 콜백이 아직 안 돈 경우) 여기서 바로 지우지는
  // 않는다. 포인터·포커스가 안에 있는 콘텐츠를 눈앞에서 걷어내지 않는 게 이 기능의 목적이고,
  // 실제 제거는 마지막 축이 벗어나는 resumeToast에서 즉시 이뤄진다.
  const pauseToast = useCallback(
    (source: ToastHoldSource) => {
      setHeld(source, true);
      if (timeoutRef.current == null) return; // 이미 멈춰 있음(다른 축이 먼저 붙잡았거나 소멸함)
      const remaining = remainingRef.current;
      if (remaining == null) return; // 타이머가 도는 중이면 항상 값이 있다(방어)
      clearTimer();
      remainingRef.current = Math.max(0, remaining - (Date.now() - startedAtRef.current));
    },
    [clearTimer, setHeld],
  );

  // hover/focus가 빠져나간 순간 — 남은 축이 없을 때만 남은 시간만큼 다시 센다.
  const resumeToast = useCallback(
    (source: ToastHoldSource) => {
      setHeld(source, false);
      if (isHeld()) return; // 다른 축이 아직 붙잡고 있으면 멈춘 채로 둔다
      if (timeoutRef.current != null) return; // 이미 돌고 있음
      const remaining = remainingRef.current;
      if (remaining == null) return; // 진행 중인 카운트다운 없음 — 유령 타이머를 만들지 않는다
      if (remaining <= 0) {
        // 붙잡혀 있는 동안(또는 붙잡히기 직전에) 이미 시간을 다 쓴 토스트. 기본 시간으로
        // 되살리지 않고 그대로 닫는다 — 벗어났는데 오히려 2.5초 더 남는 역전을 막는다.
        remainingRef.current = null;
        setToast(null);
        return;
      }
      startTimer(remaining);
    },
    [isHeld, setHeld, startTimer],
  );

  const hideToast = useCallback(() => {
    clearTimer();
    releaseAllHolds();
    remainingRef.current = null;
    setToast(null);
  }, [clearTimer, releaseAllHolds]);

  return { toast, showToast, hideToast, pauseToast, resumeToast };
}
