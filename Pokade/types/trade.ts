import { ListingGrade } from "@/types/price";

// com.pokade.domain.trade.entity.TradeStatus 미러링.
export type TradeStatus =
  "PENDING" | "SHIPPED_TO_PLATFORM" | "INSPECTED" | "DELIVERED" | "COMPLETED" | "CANCELLED";

// POST /api/trades/ready 응답 — com.pokade.domain.trade.dto.TradeReadyResponse 미러링.
// 결제창을 띄우기 전 주문만 먼저 만든 상태라, 이 시점엔 아직 매물이 잠기지 않는다.
// amount는 상품가+배송비에서 pointsToUse를 뺀, 실제 토스로 결제할 금액이다.
export interface TradeReadyResponse {
  orderId: string;
  amount: number;
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
  // 한글 매핑이 없으면 null(어설픈 오번역보다 안전하다는 팀 컨벤션, watchlist.ts와 동일).
  // 표시할 땐 cardNameKo ?? cardName.
  cardNameKo: string | null;
  cardImageUrl: string | null;
  grade: ListingGrade | null;
  price: number;
  status: TradeStatus;
  shippedAt: string | null;
  inspectedAt: string | null;
  deliveredAt: string | null;
  confirmedAt: string | null;
  settledAt: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  recipientAddress: string | null;
  createdAt: string;
  pointsUsed: number | null;
}

// 라우트 파라미터(문자열)를 거래 id로 파싱 — 양의 정수가 아니면 null (types/card.ts의 parseCardId와 동일 규칙).
export function parseTradeId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// 마이페이지 거래 내역에서 이 거래에 대한 내 입장 — 같은 거래도 보는 사람에 따라 달라지므로
// 저장된 값이 아니라 서버가 조회자 기준으로 계산해 내려준다.
export type TradeRole = "BUY" | "SELL";

// GET /api/users/me/trades 응답 항목 — com.pokade.domain.trade.dto.MyTradeResponse 미러링.
// 상대방은 id만 온다(닉네임 없음) — BE에서 cross-domain 조회와 N+1을 피하려고 의도적으로 뺐다.
export interface MyTradeResponse {
  tradeId: number;
  listingId: number;
  cardId: number;
  cardName: string | null;
  // 한글 매핑이 없으면 null(어설픈 오번역보다 안전하다는 팀 컨벤션, watchlist.ts와 동일).
  // 표시할 땐 cardNameKo ?? cardName.
  cardNameKo: string | null;
  cardImageUrl: string | null;
  grade: ListingGrade | null;
  price: number;
  status: TradeStatus;
  role: TradeRole;
  counterpartyId: number;
  createdAt: string;
  completedAt: string | null; // COMPLETED가 아니면 null
}
