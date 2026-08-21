// com.pokade.domain.notification.entity.NotificationType 미러링.
// BE는 LISTING_AVAILABLE(관심 카드에 매물 신규 등록)도 실제로 생성한다 — 예전에 이 유니온에서
// 빠져 있어서 notifStyle()이 undefined를 반환하고 알림 목록/드롭다운이 그 지점에서 깨질 수 있었다.
export type NotificationType =
  "PRICE_TARGET" | "TRADE_CONFIRMED" | "LISTING_STALE" | "INQUIRY_HANDLED" | "LISTING_AVAILABLE";

// GET /api/notifications 응답 — com.pokade.domain.notification.dto.NotificationResponse 미러링.
// message는 BE가 이미 완성된 문장으로 내려준다("리자몽 ex · ₩150,000 도달" 등) — FE에서 조합하지 않는다.
export interface NotificationResponse {
  id: number;
  type: NotificationType;
  message: string;
  // 알림이 가리키는 카드 — 문의 처리(INQUIRY_HANDLED) 등 카드와 무관한 알림은 null.
  cardId: number | null;
  // 카드 썸네일 — imageMedium 우선, 없으면 imageSmall. cardId가 있어도 카드 조회 실패 시 null일 수
  // 있어 표시 여부는 cardId가 아니라 이 필드로 직접 판단한다.
  cardImageUrl: string | null;
  isRead: boolean;
  createdAt: string;
}
