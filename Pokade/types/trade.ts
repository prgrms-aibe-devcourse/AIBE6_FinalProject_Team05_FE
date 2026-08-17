// com.pokade.domain.trade.entity.TradeStatus 미러링.
export type TradeStatus =
  | "PENDING"
  | "SHIPPED_TO_PLATFORM"
  | "INSPECTED"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED";

// POST /api/trades 요청 바디 — com.pokade.domain.trade.dto.TradeCreateRequest 미러링.
export interface TradeCreateRequest {
  listingId: number;
}

// POST/GET/PATCH /api/trades 응답 — com.pokade.domain.trade.dto.TradeResponse 미러링.
// sellerId/cardId/cardName은 거래 상태 화면에서 "누가 구매자/판매자인지", "어떤 카드인지" 표시하기 위해
// BE에 추가 요청해 받은 필드(내 매물 조회 때의 cardId/cardName 케이스와 동일한 이유).
export interface TradeResponse {
  id: number;
  listingId: number;
  buyerId: number;
  sellerId: number;
  cardId: number;
  cardName: string | null;
  price: number;
  status: TradeStatus;
  shippedAt: string | null;
  inspectedAt: string | null;
  deliveredAt: string | null;
  confirmedAt: string | null;
  settledAt: string | null;
  createdAt: string;
}

// 라우트 파라미터(문자열)를 거래 id로 파싱 — 양의 정수가 아니면 null (types/card.ts의 parseCardId와 동일 규칙).
export function parseTradeId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}
