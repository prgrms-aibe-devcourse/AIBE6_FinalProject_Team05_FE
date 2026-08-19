// com.pokade.domain.notification.entity.NotificationType 미러링.
export type NotificationType = "PRICE_TARGET" | "TRADE_CONFIRMED" | "LISTING_STALE" | "INQUIRY_HANDLED";

// GET /api/notifications 응답 — com.pokade.domain.notification.dto.NotificationResponse 미러링.
// message는 BE가 이미 완성된 문장으로 내려준다("리자몽 ex · ₩150,000 도달" 등) — FE에서 조합하지 않는다.
export interface NotificationResponse {
  id: number;
  type: NotificationType;
  message: string;
  isRead: boolean;
  createdAt: string;
}
