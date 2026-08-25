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
  // 기본은 z-50 - 대부분의 화면은 그 위에 z-[70] 이상의 오버레이가 없다. 다만 어드민의
  // 슬라이드인 상세 패널(z-[80])처럼 그보다 높은 오버레이가 열려 있는 화면에서는 토스트가
  // 패널 뒤에 깔려 안 보인다 — 그런 화면만 더 높은 값을 넘겨서 오버레이 위에 뜨게 한다.
  zIndexClassName = "z-50",
}: {
  toast: ToastState | null;
  onPause?: (source: ToastHoldSource) => void;
  onResume?: (source: ToastHoldSource) => void;
  zIndexClassName?: string;
}) {
  if (!toast) return null;

  const isError = toast.tone === "error";

  // 가로 중앙 정렬을 left-1/2 + -translate-x-1/2이 아니라 inset-x-4 + mx-auto + w-fit으로 한다.
  //
  // 예전 방식의 문제: position:fixed에서 width가 auto면 shrink-to-fit으로 폭이 정해지는데, 그때
  // "쓸 수 있는 폭"은 컨테이닝 블록(뷰포트)에서 left를 뺀 나머지다. left:50%만 주고 right를 안 주면
  // 가용 폭이 뷰포트의 절반으로 묶인다 — 360px에서 180px, 390px에서 195px. 그래서 가로로 넘치는
  // 대신 세로로 접혔다. 실제로 좁은 폭에서는 대부분의 토스트가 2줄이 됐고, 링크가 있는 관심 등록
  // 토스트는 linkLabel이 whitespace-nowrap이라 한 줄을 통째로 차지하는 바람에 남은 자리에 메시지가
  // 한두 글자씩 쌓여 7줄(높이 186px)까지 늘어났다. 알약 모양이 무너지는 건 물론이고 읽을 수가 없다.
  //
  // 양쪽 inset을 다 주면 가용 폭이 "뷰포트 - 32px" 전체가 되고, width:fit-content라 내용이 짧으면
  // 그만큼만 차지한다(짧은 토스트가 가로로 늘어지지 않는다). 좌우 margin:auto가 그 안에서 중앙을
  // 잡는다. 360/390px에서 다섯 종류 토스트가 모두 한 줄로 들어가는 것을 측정으로 확인했다.
  // 320px에서 가장 긴 실패 문구만 2줄이 되는데, 이건 감수하기로 한 범위다.
  //
  // 배경색만 성공/실패로 가르고 모서리·타이포는 그대로 둔다 — 같은 자리에 뜨는 같은 종류의
  // 알림이라는 인상을 유지하기 위함. primary(#EE1515)가 아니라 primary-dark(#B80F0F)를 쓰는 이유:
  // 흰 글자 대비가 primary는 4.4:1로 본문 크기 AA(4.5:1)에 못 미치고, primary-dark는 6.7:1로 넘긴다.
  // 새 색을 만들지 않고 기존 토큰 안에서 고른 값이다.
  const base = `fixed inset-x-4 bottom-8 ${zIndexClassName} mx-auto w-fit max-w-[calc(100vw-2rem)] rounded-full px-5 py-3 text-[13.5px] font-bold text-white shadow-lg ${
    isError ? "bg-primary-dark" : "bg-ink"
  }`;

  const linkLabel = toast.linkLabel ?? "이동";

  return (
    <>
      {/* 스크린리더 전용 알림 영역 — 문구만 담는다. 포커스를 뺏지 않고(WCAG) 떠오르는 순간
          읽힌다. 시각 토스트와 분리돼 있어 링크가 생겨도 읽히는 내용은 그대로다.
          성공·안내는 polite로 흘려보내고, 실패(tone="error")만 alert/assertive로 즉시 끼어든다 —
          예전에 실패를 카드 옆 role="alert" 인라인으로 띄우던 때의 즉시성을 토스트로 옮겨온 것이라,
          여기서 polite로 두면 접근성이 그만큼 후퇴한다. */}
      <span
        role={isError ? "alert" : "status"}
        aria-live={isError ? "assertive" : "polite"}
        className="sr-only"
      >
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
            // hover:text-white가 필요한 이유: globals.css가 전역으로 a:hover { text-secondary-dark }를
            // 걸어 두는데, 그 선택자(0,1,1)가 유틸리티 .text-white(0,1,0)를 이긴다. 그대로 두면 마우스를
            // 올리는 순간 앵커가 파랑(#2C3AA0)이 되고, 색 지정이 없는 아래 메시지 span이 그 색을
            // 상속해 어두운 토스트 배경에서 거의 보이지 않는다. 행선지 라벨 span은 자신이
            // text-tertiary를 갖고 있어 상속을 받지 않으므로 그대로 유지된다.
            className="flex items-center gap-2.5 rounded-full text-white outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
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
        ) : toast.action ? (
          // 이동이 아닌 동작(실행취소 등, #238). 링크와 같은 모양을 쓰되 button이라 페이지가
          // 바뀌지 않는다. 시각 요소는 aria-hidden이고 버튼만 이름을 직접 갖는 것도 링크 분기와
          // 동일한 이유 — sr-only 영역이 문구를 이미 읽어줬으므로 두 번 읽히지 않게 한다.
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true">{toast.message}</span>
            <span aria-hidden="true" className="h-3 w-px bg-white/30" />
            <button
              type="button"
              onClick={toast.action.onClick}
              aria-label={`${toast.message} — ${toast.action.label}`}
              className="whitespace-nowrap rounded-full text-tertiary outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
            >
              {toast.action.label}
            </button>
          </div>
        ) : (
          <span aria-hidden="true">{toast.message}</span>
        )}
      </div>
    </>
  );
}
