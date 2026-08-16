import React from "react";
import { NotificationType } from "@/types/notification";

// 알림 드롭다운(Header)과 전체 알림 페이지(/notifications)가 공유하는 타입별 표시 매핑.
export function notifStyle(type: NotificationType): { tint: string; icon: React.ReactNode } {
  switch (type) {
    case "PRICE_TARGET":
      return {
        tint: "#FFF6DA",
        icon: (
          <svg
            width="17"
            height="17"
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
            width="17"
            height="17"
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
            width="17"
            height="17"
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
