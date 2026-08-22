import React from "react";
import { NotificationType } from "@/types/notification";

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
