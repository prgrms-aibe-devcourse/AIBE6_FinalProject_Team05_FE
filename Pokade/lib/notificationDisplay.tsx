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
    case "INQUIRY_RECEIVED":
      // INQUIRY_HANDLED(초록 말풍선 = 내 문의가 처리됨)와 같은 "문의" 계열이지만 방향이 반대라
      // — 이건 관리자에게 "처리할 것이 들어왔다"고 알리는 쪽이다 — 색과 모양을 모두 갈라 둔다.
      // 새 색을 만들지 않고 이 파일에 이미 있는 남색(TRADE_CONFIRMED와 같은 쌍)을 재사용한다.
      // 겹쳐도 헷갈리지 않는 이유: TRADE_CONFIRMED는 BE에 생성 코드가 없어 실제로 내려오지
      // 않는 값이고(아래 notificationHref 주석 참고), 아이콘 모양이 서로 다르다.
      // 아이콘은 받은 문서함(트레이로 들어가는 화살표) — "도착"을 나타낸다.
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
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 13h5l1.5 3h5L16 13h5" />
            <path d="M4.5 6.5L3 13v5.5h18V13l-1.5-6.5" />
            <path d="M12 3v6" />
            <path d="M9.5 6.5L12 9l2.5-2.5" />
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
    // 거래 단계 알림 4종(#392). 넷이 한 화면에 나란히 쌓일 수 있고 기존 TRADE_CONFIRMED(남색
    // 상자)까지 더하면 "거래"만 다섯 줄이 되므로, 색보다 아이콘 모양으로 갈라 읽히게 한다 —
    // 트럭(발송) / 체크된 서류(배송 완료) / X(취소) / 마주 보는 화살표(체결). 색은 새로 만들지
    // 않고 이 파일에 이미 있는 네 쌍에서 의미가 맞는 것을 골라 쓴다.
    case "TRADE_SHIPPING_REQUIRED":
      // 주황(LISTING_STALE과 같은 쌍) — 둘 다 "네가 움직이지 않으면 멈춰 있다"는 재촉 신호다.
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
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 7h11v9H3z" />
            <path d="M14 10h3.5l3 3v3H14z" />
            <circle cx="7" cy="18" r="1.6" />
            <circle cx="17.5" cy="18" r="1.6" />
          </svg>
        ),
      };
    case "TRADE_DELIVERED":
      // 초록(INQUIRY_HANDLED와 같은 쌍) — "한 단계가 무사히 끝났다"는 같은 결의 신호.
      // 아이콘은 말풍선이 아니라 체크된 서류라 초록끼리도 헷갈리지 않는다.
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
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 4h6v3H9z" />
            <path d="M15 5.5h3V20H6V5.5h3" />
            <path d="M9 13.5l2 2 4-4" />
          </svg>
        ),
      };
    case "TRADE_CANCELLED":
      // 회색 — 이 파일에 부정/중단을 나타낼 색이 이것뿐이다(빨강 계열은 이 파일에 없고,
      // 새 색은 만들지 않는다). 아래 default도 같은 회색이지만 그쪽은 종 아이콘이라 구분된다.
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
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M15 9l-6 6" />
            <path d="M9 9l6 6" />
          </svg>
        ),
      };
    case "BUY_OFFER_MATCHED":
      // 금색(PRICE_TARGET과 같은 쌍) — 둘 다 "걸어 둔 조건이 맞아떨어졌다"는 성사 신호다.
      // 아이콘은 양쪽에서 마주 보고 만나는 화살표 — 내 입찰과 상대 판매가 붙었다는 뜻.
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
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 12h5" />
            <path d="M16 12h5" />
            <path d="M6.5 8.5L10 12l-3.5 3.5" />
            <path d="M17.5 8.5L14 12l3.5 3.5" />
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

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const YEAR_MS = 365 * DAY_MS;

// 알림이 온 시각 표시. 예전에는 항상 "MM. DD. 오전 HH:MM" 절대시각이라, 2분 전에 도착한
// 알림도 시계를 봐야 새 건지 알 수 있었다(#238). 최근 것일수록 "얼마나 지났나"가 궁금하고
// 오래된 것일수록 "언제였나"가 궁금하다는 점에 맞춰 세 구간으로 나눈다.
//
// - 24시간 이내: "방금 전" / "N분 전" / "N시간 전"  — 최신성 판단이 목적
// - 24시간~1년: 기존 절대시각 그대로            — "며칠 전"보다 날짜가 더 유용해지는 구간
// - 1년 이상:   연도까지                        — 연도가 없으면 해가 모호해진다
//
// 상대시간은 렌더 시점에 계산되므로 저절로 갱신되지는 않는다 — 헤더 드롭다운은 30초 폴링이
// 목록을 교체하며 다시 그려주고(useNotificationStore), 전체 목록은 읽음/삭제 같은 조작마다
// 다시 불러온다. 초 단위 정확도가 필요한 화면이 아니라 별도 타이머는 두지 않았다.
export function formatNotifTime(iso: string): string {
  const date = new Date(iso);
  // 파싱 실패 시 예전에는 "Invalid Date"가 그대로 화면에 찍혔다 — 원문을 돌려주는 편이 낫다.
  if (Number.isNaN(date.getTime())) return iso;

  // 시계 오차 등으로 미래 시각이 오면 음수가 되는데, "-3분 전"이 뜨지 않게 0으로 눌러둔다.
  const elapsedMs = Math.max(0, Date.now() - date.getTime());

  if (elapsedMs < MINUTE_MS) return "방금 전";
  if (elapsedMs < HOUR_MS) return `${Math.floor(elapsedMs / MINUTE_MS)}분 전`;
  if (elapsedMs < DAY_MS) return `${Math.floor(elapsedMs / HOUR_MS)}시간 전`;

  if (elapsedMs < YEAR_MS) {
    return date.toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// 내 문의 목록 경로. 문의 "작성"은 /inquiries/new이고 목록은 마이페이지 아래에 있다 —
// /inquiries 목록 라우트는 존재하지 않으므로(app/inquiries에는 new/만 있다) 여기로 보낸다.
const MY_INQUIRIES_PATH = "/mypage/inquiries";

// 관리자 문의 관리 화면(app/admin/inquiries). INQUIRY_RECEIVED는 관리자에게만 가는 알림이라
// 내 문의 목록이 아니라 이쪽으로 보낸다 — 받는 사람이 처리해야 할 곳이 여기다.
const ADMIN_INQUIRIES_PATH = "/admin/inquiries";

// 알림을 눌렀을 때 이동할 곳. null이면 이동 없이 읽음 처리만 한다.
// 헤더 드롭다운(components/Header.tsx)과 전체 알림 페이지(app/notifications/page.tsx)가 각자
// `if (n.cardId != null) router.push(...)`를 들고 있었는데, 목적지 규칙이 타입별로 갈라지기
// 시작해서(#238) 한 곳으로 합쳤다 — 두 화면이 다른 곳으로 가는 일이 없게 한다.
//
// cardId를 먼저 보는 이유: 카드가 딸린 알림은 타입과 무관하게 카드 상세가 가장 구체적인
// 도착지다. 문의 계열(INQUIRY_HANDLED / INQUIRY_RECEIVED)은 BE가 cardId를 채우지 않으므로
// (NotificationService의 빌더에 cardId 자체가 없다) 항상 아래 분기로 떨어진다.
//
// 거래 단계 알림 4종(#392, TRADE_SHIPPING_REQUIRED / TRADE_DELIVERED / TRADE_CANCELLED /
// BUY_OFFER_MATCHED)은 cardId가 채워져 오므로 이 첫 분기를 타 카드 상세로 간다. 알림이 말하는
// 내용("발송해 주세요", "구매확정 해주세요")을 실제로 처리하는 곳은 카드 상세가 아니라 거래
// 상세(/trade-status/{id})지만, 지금은 거기로 보낼 방법이 없다 — notifications 테이블에는
// card_id와 inquiry_id만 있고 trade_id 컬럼이 없어서(V1 baseline 이후 추가된 적 없음) 알림
// 레코드만으로는 어느 거래인지 알 수 없다. 메시지 문자열에서 거래를 역추적하는 건 문의 쪽에서
// 이미 접었던 방식이라 되풀이하지 않는다. BE에 trade_id가 생기면 여기서 타입별로 갈라
// /trade-status/{tradeId}로 보내면 된다 — 그 전까지는 카드 상세가 차선책이다.
//
// 문의 계열은 목록까지만 보내고 해당 문의를 펼쳐 주지는 못한다. 남은 걸림돌은 식별자가 아니라
// 화면이다 — V12(#338)가 notifications에 inquiry_id를 추가했고 BE NotificationResponse가
// inquiryId를 내려주며 types/notification.ts도 이미 그 필드를 미러링하고 있다. 다만 두 문의
// 화면(/mypage/inquiries, /admin/inquiries) 어느 쪽에도 "특정 문의를 펼친 상태로 여는" 진입점이
// 없어서, 지금 여기서 id를 붙여 봐야 받아 줄 곳이 없다. 그 진입점이 생기면 n.inquiryId를 그대로
// 얹으면 된다 — 값은 이미 손안에 있다.
//
// 그래서 지금은 이 함수가 null을 돌려줄 일이 사실상 없다. BE가 실제로 만드는 열 종류를 훑어보면
// (NotificationService의 create*Notification 메서드들) cardId 없이 오는 것은 문의 계열 둘뿐이고
// — 그 둘의 빌더에는 cardId 대신 inquiryId만 있다 — 나머지 여덟은 전부 cardId를 채워 보내 위
// 첫 분기로 빠진다. 문의 둘도 바로 위에서 각자의 목록으로 보내진다.
//
// 그럼에도 null 반환을 남겨 두는 이유는 notifications.card_id가 nullable이기 때문이다. 채워
// 보내야 할 알림이 어떤 사정으로 cardId 없이 내려오면 여기서 "갈 곳 없음"으로 떨어져 읽음
// 처리만 되고, /cards/null 같은 존재하지 않는 주소로 튀지 않는다. FE 유니온에 아직 없는 새
// 타입이 내려오는 경우에도 같은 안전망이 된다.

// 재입고 알림을 타고 들어왔다는 표시(#238). 카드 상세가 "매물이 하나도 없는데 왜 알림이 왔지"를
// 설명할 수 있게 붙인다 — 도착 시점엔 이미 팔렸거나 다른 사람이 결제 중이라 ACTIVE에서 빠졌을 수
// 있는데(TRADING), 화면엔 그냥 "판매 중인 상품이 없어요"만 뜨기 때문이다.
//
// 재입고에만 붙이는 이유: "상품이 새로 등록됐어요"는 그 순간 매물이 있다고 약속한 알림이라
// 없을 때 해명이 필요하다. 반면 목표가 알림은 실제 매물이 아니라 시세/최근 체결가로도 도달
// 판정이 나므로(WatchlistTargetPriceEvaluator) 애초에 매물을 약속하지 않는다 — 거기에 "팔렸을
// 수 있어요"를 띄우면 있지도 않던 매물을 있었다고 말하는 셈이 된다.
export const NOTIFICATION_ORIGIN_PARAM = "from";
export const NOTIFICATION_ORIGIN_VALUE = "notification";

export function notificationHref(n: NotificationResponse): string | null {
  if (n.cardId != null) {
    const origin =
      n.type === "LISTING_AVAILABLE"
        ? `?${NOTIFICATION_ORIGIN_PARAM}=${NOTIFICATION_ORIGIN_VALUE}`
        : "";
    return `/cards/${n.cardId}${origin}`;
  }
  if (n.type === "INQUIRY_HANDLED") return MY_INQUIRIES_PATH;
  if (n.type === "INQUIRY_RECEIVED") return ADMIN_INQUIRIES_PATH;
  return null;
}

// "모두 읽음 처리" 버튼 스타일 — 헤더 드롭다운과 전체 알림 페이지가 같은 모양을 쓰도록 공유한다(#238).
// 예전에는 두 곳이 각자 text-xs 텍스트 링크라 클릭 영역이 68×16px밖에 안 됐다. 링크처럼 보이던 걸
// 패딩 있는 버튼 면으로 바꿔 세로 28px 남짓을 확보하고, hover 시 배경을 깔아 누를 수 있는 것임을
// 분명히 한다(터치 권장치 44px에는 못 미치지만 두 화면 모두 보조 액션이라 이 선에서 멈춘다).
// 문자열로 빼두면 prettier-plugin-tailwindcss의 클래스 정렬 대상이 아니게 되는데, 두 화면이
// 어긋나는 것보다는 한 곳에서 관리되는 편이 낫다고 판단했다.
export const MARK_ALL_READ_BUTTON_CLASS =
  "rounded-lg px-2.5 py-1.5 text-[12.5px] font-bold text-secondary transition-colors hover:bg-lavender hover:text-secondary-dark";
