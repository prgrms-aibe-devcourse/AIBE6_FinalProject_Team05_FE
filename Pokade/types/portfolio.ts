// GET /api/portfolio, POST /api/portfolio, PUT /api/portfolio/{id} 응답 —
// com.pokade.domain.portfolio.dto.PortfolioItemResponse 미러링.
export interface PortfolioItemResponse {
  id: number;
  cardId: number;
  cardName: string | null;
  cardImageSmall: string | null;
  variantId: number | null;
  variantName: string | null;
  quantity: number;
  acquiredPrice: number | null;
  acquiredAt: string | null;
  tradeId: number | null;
  // 대표 변형(raw NM) 기준 Scrydex 시세. 데이터 없으면 null.
  currentMarketPrice: number | null;
  currency: string | null;
}

// POST /api/portfolio 요청 바디 — com.pokade.domain.portfolio.dto.PortfolioItemAddRequest 미러링.
export interface PortfolioItemAddRequest {
  cardId: number;
  variantId?: number;
  quantity: number;
  acquiredPrice?: number;
  acquiredAt?: string;
}

// PUT /api/portfolio/{id} 요청 바디 — com.pokade.domain.portfolio.dto.PortfolioItemUpdateRequest 미러링.
// 세 필드 모두 optional — 넘긴 값만 부분 반영된다(BE PortfolioItem.update()).
export interface PortfolioItemUpdateRequest {
  quantity?: number;
  acquiredPrice?: number;
  acquiredAt?: string;
}

// GET /api/portfolio/summary 응답 — com.pokade.domain.portfolio.dto.PortfolioSummaryResponse 미러링.
// 시세 정보가 없는 항목은 계산에서 제외되며, 보유 카드가 없거나 전부 시세 없음이면 전부 0/null.
export interface PortfolioSummaryResponse {
  totalValue: number;
  changeAmount: number;
  changeRate: number;
  currency: string | null;
}

// GET /api/portfolio/{id}/pnl 응답 — com.pokade.domain.portfolio.dto.PortfolioItemPnlResponse 미러링.
export interface PortfolioItemPnlResponse {
  id: number;
  cardId: number;
  quantity: number;
  acquiredPrice: number;
  currentMarketPrice: number;
  currency: string;
  pnlAmount: number;
  pnlRate: number;
}

// GET /api/portfolio/analytics 응답 — com.pokade.domain.portfolio.dto.PortfolioAnalyticsItemResponse 미러링.
export interface PortfolioAnalyticsItemResponse {
  label: string;
  value: number;
  ratio: number;
}

// com.pokade.domain.portfolio.dto.PortfolioAnalyticsResponse 미러링.
export interface PortfolioAnalyticsResponse {
  bySet: PortfolioAnalyticsItemResponse[];
  byRarity: PortfolioAnalyticsItemResponse[];
}

// GET /api/portfolio/set-completion 응답 항목 — com.pokade.domain.portfolio.dto.PortfolioSetCompletionResponse 미러링.
// ownedCount는 해당 세트에서 보유 중인 서로 다른 카드 수(수량 무시), totalCount는 세트 전체 카드 수.
// expansion 정보가 없는 카드는 백엔드에서 이미 제외되므로, 여기 담긴 세트는 전부 완성도 계산이 가능하다.
export interface PortfolioSetCompletionResponse {
  expansionId: string;
  setName: string;
  ownedCount: number;
  totalCount: number;
  completionRate: number;
}
