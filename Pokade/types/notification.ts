// com.pokade.domain.notification.entity.NotificationType 미러링.
// BE는 LISTING_AVAILABLE(관심 카드에 매물 신규 등록)도 실제로 생성한다 — 예전에 이 유니온에서
// 빠져 있어서 notifStyle()이 undefined를 반환하고 알림 목록/드롭다운이 그 지점에서 깨질 수 있었다.
//
// INQUIRY_RECEIVED(#392)는 지금까지의 값들과 달리 수신자가 일반 사용자가 아니라 관리자다 —
// 사용자가 1:1 문의를 올리면 관리자에게 간다. 저장 테이블과 조회 API(GET /api/notifications)는
// 그대로 공유하므로 관리자 계정에서는 자기 알림 목록에 일반 알림과 섞여 내려온다.
//
// 거래 단계 알림 4종(#392)은 거래가 한 칸씩 움직일 때마다 "다음에 움직여야 할 사람"에게 간다 —
// TRADE_SHIPPING_REQUIRED는 판매자에게, TRADE_DELIVERED는 구매자에게, TRADE_CANCELLED는 취소를
// 누르지 않은 반대편에게. BUY_OFFER_MATCHED만 TRADE_ 접두사를 쓰지 않는데, 받는 사람 관점에서
// 이건 "거래 진행"이 아니라 "내가 걸어 둔 입찰이 체결됐다"이기 때문이다(BE enum 주석과 동일 기준).
//
// BUY_OFFER_RECEIVED(#417)는 BUY_OFFER_MATCHED와 짝이지만 방향이 반대다 — 체결이 아니라
// "구매 입찰이 등록됐다"를 그 카드 매물을 가진 판매자에게 알린다("즉시판매로 바로 팔 수 있어요").
// 받는 사람이 입찰자가 아니라 판매자라 같은 입찰 계열이어도 읽는 관점이 다르다.
// INQUIRY_RECEIVED처럼 수신자가 한 명이 아니라 여럿이다 — 입찰 하나에 그 카드 매물을 가진 판매자
// 전원이 같은 문구를 동시에 받는다(BE는 판매자별로 레코드를 따로 만든다). 팬아웃 인원과 재발송에
// 상한이 없어서, 매물이 많은 인기 카드에 입찰이 연달아 들어오면 한 판매자의 목록에 문구가 같거나
// 가격만 다른 알림이 계속 쌓인다 — 화면에서 묶거나 걸러 주지 않으므로 그대로 나열된다.
export type NotificationType =
  | "PRICE_TARGET"
  | "TRADE_CONFIRMED"
  | "LISTING_STALE"
  | "INQUIRY_HANDLED"
  | "LISTING_AVAILABLE"
  | "INQUIRY_RECEIVED"
  | "TRADE_SHIPPING_REQUIRED"
  | "TRADE_DELIVERED"
  | "TRADE_CANCELLED"
  | "BUY_OFFER_MATCHED"
  | "BUY_OFFER_RECEIVED";

// GET /api/notifications 응답 — com.pokade.domain.notification.dto.NotificationResponse 미러링.
// message는 BE가 이미 완성된 문장으로 내려준다("리자몽 ex · ₩150,000 도달" 등) — FE에서 조합하지 않는다.
export interface NotificationResponse {
  id: number;
  type: NotificationType;
  message: string;
  // 알림이 가리키는 카드 — 문의 계열(INQUIRY_HANDLED/INQUIRY_RECEIVED) 등 카드와 무관한 알림은 null.
  // 거래 단계 알림 4종은 카드를 채워서 내려온다.
  cardId: number | null;
  // 알림이 가리키는 문의(V12/#338에서 notifications에 inquiry_id가 추가됨). 문의 계열이 아니면 null.
  // 지금은 화면에서 쓰지 않는다 — 특정 문의를 펼쳐 주는 진입점이 문의 목록 쪽에 아직 없어서
  // notificationHref()가 목록까지만 보낸다. BE가 이미 내려주는 값이라 타입만 먼저 맞춰 둔다.
  inquiryId: number | null;
  // 카드 썸네일 — imageMedium 우선, 없으면 imageSmall. cardId가 있어도 카드 조회 실패 시 null일 수
  // 있어 표시 여부는 cardId가 아니라 이 필드로 직접 판단한다.
  cardImageUrl: string | null;
  isRead: boolean;
  createdAt: string;
}
