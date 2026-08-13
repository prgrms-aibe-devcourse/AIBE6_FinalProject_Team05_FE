import { CardPriceSummaryResponse } from "@/types/price";

// GET /api/watchlist 응답 항목 — com.pokade.domain.watchlist.dto.WatchlistResponse 미러링.
// cardName/setName/imageUrl은 BE가 카드 테이블을 배치 조회해 함께 채워준다(ListingSummaryResponse/
// PriceRankingResponse와 동일 패턴) — 카드가 삭제된 경우 등에는 null일 수 있다.
// currentPrice: PriceService.getSummaries() 배치 조회 결과, 매물/체결/참고시세가 전혀 없으면 null.
// changeRate: 최근 7일 vs 이전 7일 S등급 평균 체결가 비교(%, PriceStatsResponse/PriceRankingResponse와 동일 기준),
// 데이터가 부족하면 0으로 채워져서 온다(카드 자체가 없거나 시세 조회가 안 된 경우에만 null).
// targetReached: 체결가가 최저~최고 구간 안에서 목표가를 한 번이라도 지나간 적이 있으면 true
// (지금 시세가 목표가보다 높은지/낮은지가 아니라 "그동안 그 가격을 실제로 거쳐 갔는지" 기준).
export interface WatchlistResponse {
  id: number;
  cardId: number;
  variantId: number | null;
  cardName: string | null;
  setName: string | null;
  imageUrl: string | null;
  targetBuyPrice: number | null;
  targetSellPrice: number | null;
  isNotified: boolean;
  createdAt: string;
  currentPrice: CardPriceSummaryResponse | null;
  changeRate: number | null;
  targetReached: boolean;
}

// POST /api/watchlist 요청 바디 — com.pokade.domain.watchlist.dto.WatchlistCreateRequest 미러링.
// targetBuyPrice/targetSellPrice 중 최소 하나는 필수(BE가 둘 다 없으면 400 TARGET_PRICE_REQUIRED).
export interface WatchlistCreateRequest {
  cardId: number;
  variantId?: number;
  targetBuyPrice?: number;
  targetSellPrice?: number;
}
