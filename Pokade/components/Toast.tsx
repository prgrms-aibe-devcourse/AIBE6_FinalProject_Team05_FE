"use client";

import Link from "next/link";
import { ToastState } from "@/hooks/useToast";

// 화면 하단 중앙에 뜨는 알림. 홈/마켓/카드상세가 각자 갖고 있던 동일한 JSX를 하나로 합쳤다(#235).
//
// href가 있으면 전체가 링크가 된다 — 관심 "등록" 토스트는 눌러서 /watchlist로 이동해 목표가를
// 입력할 수 있게(#235), "해제"처럼 갈 곳이 없는 알림은 href 없이 기존처럼 읽고 지나가는 알림으로
// 남는다. 바깥 div가 role="status"를 계속 들고 있어 링크가 되어도 스크린리더에는 알림으로 읽히고,
// 안쪽 Link는 실제 <a>라서 Tab 포커스·엔터 이동이 기본으로 따라온다.
export default function Toast({ toast }: { toast: ToastState | null }) {
  if (!toast) return null;

  const base =
    "fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-5 py-3 text-[13.5px] font-bold text-white shadow-lg";

  return (
    <div role="status" className={base}>
      {toast.href ? (
        <Link
          href={toast.href}
          className="flex items-center gap-2.5 text-white outline-none focus-visible:underline"
        >
          <span>{toast.message}</span>
          {/* 구분선 + 행선지 라벨 — "누를 수 있다"와 "누르면 어디로 간다"를 문구를 늘리지 않고
              한 번에 보여준다(안내 문장을 덧붙이는 대신 택한 방식, #235). */}
          <span aria-hidden="true" className="h-3 w-px bg-white/30" />
          <span className="whitespace-nowrap text-tertiary">
            {toast.linkLabel ?? "이동"}
            <span aria-hidden="true"> →</span>
          </span>
        </Link>
      ) : (
        toast.message
      )}
    </div>
  );
}
