"use client";

import Link from "next/link";
import { ToastHoldSource, ToastState } from "@/hooks/useToast";

// 화면 하단 중앙에 뜨는 알림. 홈/마켓/카드상세가 각자 갖고 있던 동일한 JSX를 하나로 합쳤다(#235).
//
// href가 있으면 전체가 링크가 된다 — 관심 "등록" 토스트는 눌러서 /watchlist로 이동해 목표가를
// 입력할 수 있게(#235), "해제"처럼 갈 곳이 없는 알림은 href 없이 기존처럼 읽고 지나가는 알림으로
// 남는다.
//
// 알림 영역(live region)과 시각 토스트를 분리한 이유(CodeRabbit 리뷰):
// 예전에는 바깥 div 하나가 role="status"를 들고 링크까지 품고 있었다. role="status"는 암묵적으로
// aria-live="polite"라 "떠오르는 순간" 읽히는 영역인데, 그 안에 Tab으로 도달해야 하는 링크를 같이
// 두면 읽히는 것과 조작하는 것이 한 덩어리로 묶여 버린다. 그래서
//   - 스크린리더에 읽힐 문구는 sr-only 영역이 전담하고,
//   - 눈에 보이는 토스트는 role 없이 순수 시각/조작 요소로 남긴다.
// 시각 토스트에 aria-hidden을 걸지 않는 이유: 그 안에 포커스 가능한 링크가 있어서, 조상에
// aria-hidden을 걸면 "접근성 트리에는 없는데 Tab으로는 닿는" 잘못된 상태가 된다. 대신 중복해서
// 읽히는 텍스트 노드만 aria-hidden으로 가리고, 링크에는 aria-label로 이름을 직접 준다.
//
// onPause/onResume: hover/focus가 안에 있는 동안 자동 소멸 타이머를 멈춘다(useToast.ts).
// 없으면(전달 안 하면) 기존처럼 그냥 시간이 지나면 사라진다. 포인터(hover)와 포커스(키보드)는
// 동시에 걸릴 수 있으므로 어느 축인지를 인자로 함께 넘긴다 — 마우스만 벗어났는데 포커스가 아직
// 토스트 안에 있는 상태에서 타이머가 재개되면 안 되기 때문이다(CodeRabbit 리뷰).
export default function Toast({
  toast,
  onPause,
  onResume,
}: {
  toast: ToastState | null;
  onPause?: (source: ToastHoldSource) => void;
  onResume?: (source: ToastHoldSource) => void;
}) {
  if (!toast) return null;

  const base =
    "fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-5 py-3 text-[13.5px] font-bold text-white shadow-lg";

  const linkLabel = toast.linkLabel ?? "이동";

  return (
    <>
      {/* 스크린리더 전용 알림 영역 — 문구만 담는다. 포커스를 뺏지 않고(WCAG) 떠오르는 순간
          polite로 읽힌다. 시각 토스트와 분리돼 있어 링크가 생겨도 읽히는 내용은 그대로다. */}
      <span role="status" aria-live="polite" className="sr-only">
        {toast.message}
      </span>

      {/* 눈에 보이는 토스트 — role 없음. onFocus/onBlur는 React에서 버블링되므로(focusin/
          focusout) 안쪽 링크로 Tab이 들어오고 나가는 것도 여기서 함께 잡힌다. */}
      <div
        className={base}
        onMouseEnter={() => onPause?.("pointer")}
        onMouseLeave={() => onResume?.("pointer")}
        onFocus={() => onPause?.("focus")}
        onBlur={(event) => {
          // 토스트 "안에서" 포커스가 옮겨 다니는 것(focusout 직후 focusin)은 벗어남이 아니다 —
          // 그대로 resume을 부르면 타이머가 잠깐 재시작됐다가 다시 멈추는 헛돌기가 생긴다.
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          onResume?.("focus");
        }}
      >
        {toast.href ? (
          <Link
            href={toast.href}
            // 시각 요소는 전부 aria-hidden이라, 링크의 이름은 여기서 직접 준다 —
            // sr-only 영역이 읽어준 문구와 "어디로 가는지"를 한 번에 전달한다.
            aria-label={`${toast.message} — ${linkLabel}(으)로 이동`}
            className="flex items-center gap-2.5 rounded-full text-white outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
          >
            <span aria-hidden="true">{toast.message}</span>
            {/* 구분선 + 행선지 라벨 — "누를 수 있다"와 "누르면 어디로 간다"를 문구를 늘리지 않고
                한 번에 보여준다(안내 문장을 덧붙이는 대신 택한 방식, #235). */}
            <span aria-hidden="true" className="h-3 w-px bg-white/30" />
            <span aria-hidden="true" className="whitespace-nowrap text-tertiary">
              {linkLabel}
              <span> →</span>
            </span>
          </Link>
        ) : (
          <span aria-hidden="true">{toast.message}</span>
        )}
      </div>
    </>
  );
}
