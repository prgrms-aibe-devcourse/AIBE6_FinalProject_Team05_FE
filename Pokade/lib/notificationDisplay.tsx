import React from "react";
import { NotificationResponse, NotificationType } from "@/types/notification";

// 알림 드롭다운(Header)과 전체 알림 페이지(/notifications)가 공유하는 타입별 표시 매핑.
// size: 카드 썸네일이 없을 때(기존 34~40px 아이콘 박스)는 기본값 17을 그대로 쓰고, 썸네일 위
// 코너 배지로 겹쳐 그릴 때는 더 작게(size=10) 요청한다 — 아이콘 자체는 하나만 두고 크기만 다르게.
export function notifStyle(
  type: NotificationType,
  size: number = 17,
): { tint: string; icon: React.ReactNode } {
  switch (type) {
    case "PRICE_TARGET":
      return {
        tint: "#FFF6DA",
        icon: (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#B8860B"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="8" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        ),
      };
    case "TRADE_CONFIRMED":
      return {
        tint: "#EEF0FA",
        icon: (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#3B4CCA"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M3 8l9-5 9 5v8l-9 5-9-5z" />
            <path d="M3 8l9 5 9-5" />
          </svg>
        ),
      };
    case "LISTING_STALE":
      return {
        tint: "#FFF3E0",
        icon: (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#C2790A"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 3" />
          </svg>
        ),
      };
    case "INQUIRY_HANDLED":
      return {
        tint: "#EAF7EF",
        icon: (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#059669"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
          </svg>
        ),
      };
    case "LISTING_AVAILABLE":
      // 기존 4개(금색/남색/주황/초록)와 안 겹치는 청록 계열 — 재입고(새 상품)를 나타내는 상자 아이콘.
      return {
        tint: "#E3F6F5",
        icon: (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#0E7C86"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" />
            <path d="M3 8l9 5 9-5" />
            <path d="M12 13v8" />
          </svg>
        ),
      };
    default: {
      // 타입에 값을 추가하면 여기서 컴파일이 막힌다 - 분기를 빠뜨릴 수 없다.
      const exhaustive: never = type;
      void exhaustive;
      // BE가 FE 타입에 없는 값을 내려보내는 경우(저장소가 달라 미러링이 어긋날 수 있다)
      // 화면을 죽이지 않고 기본 스타일로 렌더한다.
      return {
        tint: "#F2F2F5",
        icon: (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#8A8A92"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
            <path d="M13.7 21a2 2 0 01-3.4 0" />
          </svg>
        ),
      };
    }
  }
}

export function formatNotifTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 내 문의 목록 경로. 문의 "작성"은 /inquiries/new이고 목록은 마이페이지 아래에 있다 —
// /inquiries 목록 라우트는 존재하지 않으므로(app/inquiries에는 new/만 있다) 여기로 보낸다.
const MY_INQUIRIES_PATH = "/mypage/inquiries";

// 알림을 눌렀을 때 이동할 곳. null이면 이동 없이 읽음 처리만 한다.
// 헤더 드롭다운(components/Header.tsx)과 전체 알림 페이지(app/notifications/page.tsx)가 각자
// `if (n.cardId != null) router.push(...)`를 들고 있었는데, 목적지 규칙이 타입별로 갈라지기
// 시작해서(#238) 한 곳으로 합쳤다 — 두 화면이 다른 곳으로 가는 일이 없게 한다.
//
// cardId를 먼저 보는 이유: 카드가 딸린 알림은 타입과 무관하게 카드 상세가 가장 구체적인
// 도착지다. INQUIRY_HANDLED는 BE가 cardId를 채우지 않으므로(NotificationService의 빌더에
// cardId 자체가 없다) 항상 아래 분기로 떨어진다.
//
// 문의 목록까지만 보내고 해당 문의를 열어주지는 못한다 — 알림 레코드에 문의 식별자가 없고
// (notifications 테이블에 card_id만 있다) 메시지에 박힌 제목 문자열로 매칭하는 건 제목에
// 따옴표가 섞이면 바로 깨진다. 식별자가 응답에 추가되면 그때 특정 문의를 열도록 확장한다.
//
// 그 외 cardId가 없는 타입(TRADE_CONFIRMED, LISTING_STALE - 현재 BE에 생성 코드가 없는 값들)은
// 갈 곳이 없으므로 기존과 동일하게 null을 반환해 읽음 처리만 되게 둔다.
export function notificationHref(n: NotificationResponse): string | null {
  if (n.cardId != null) return `/cards/${n.cardId}`;
  if (n.type === "INQUIRY_HANDLED") return MY_INQUIRIES_PATH;
  return null;
}
