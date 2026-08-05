// 시세 API(BE) 응답 형태 — com.pokade.domain.price.dto.PriceSummaryResponse 미러링.
export interface PriceSummaryResponse {
  buyPrice: number | null;
  sellPrice: number | null;
  currency: string;
}

// GET /api/prices/summaries 배치 응답 항목 — com.pokade.domain.price.dto.CardPriceSummaryResponse 미러링.
// recentTradePrice: includeRecentTradePrice=true로 요청했을 때만 채워짐(해당 grade 기준 최근 체결가).
export interface CardPriceSummaryResponse {
  cardId: number;
  buyPrice: number | null;
  sellPrice: number | null;
  currency: string;
  recentTradePrice?: number | null;
}

// 매물/체결 등급 — com.pokade.domain.listing.ListingGrade 미러링.
// AI 등급진단 도메인의 Grade("S"|"A"|"B")와는 별개 개념(판매자가 매물 등록 시 직접 표기하는 등급).
export type ListingGrade = "S" | "A" | "B" | "PSA10" | "PSA9" | "PSA8";

// com.pokade.domain.price.dto.TradeSummaryResponse 미러링.
export interface TradeSummaryResponse {
  tradedAt: string;
  price: number;
  grade: ListingGrade | null;
}

// com.pokade.domain.price.ChartPeriod 미러링 — GET /api/prices/{cardId}/chart?period= 값.
export type ChartPeriod = "30d" | "90d" | "1y";

// com.pokade.domain.price.dto.PriceStatsResponse 미러링 — GET /api/prices/{cardId}/stats.
// changeRate(%)·changeAmount(원)는 최근 7일 vs 이전 7일 S등급 평균 체결가 비교, 데이터 부족 시 둘 다 0.
// volume: 최근 7일 S등급 체결 건수.
export interface PriceStatsResponse {
  changeRate: number;
  changeAmount: number;
  volume: number;
}

// com.pokade.domain.listing.ListingStatus 미러링.
export type ListingStatus = "ACTIVE" | "TRADING" | "SOLD" | "EXPIRED" | "CANCELLED" | "HIDDEN";

// com.pokade.domain.listing.dto.ListingSummaryResponse 미러링.
// cardId/cardName은 "내 매물" 화면에서 카드 상세로 연결하기 위해 BE에 추가 요청해 받은 필드.
// 매물 사진은 없음 — 매칭은 플랫폼이 중개하므로 실물 사진을 보여줄 필요가 없어 제외.
export interface ListingSummaryResponse {
  id: number;
  sellerId: number;
  cardId: number;
  cardName: string | null;
  price: number;
  grade: ListingGrade | null;
  status: ListingStatus;
  createdAt: string;
}

// POST /api/listings 요청 바디 — com.pokade.domain.listing.dto.ListingCreateRequest 미러링.
export interface ListingCreateRequest {
  cardId: number;
  variantId?: number;
  price: number;
  grade?: ListingGrade;
}

// PUT /api/listings/{id} 요청 바디 — com.pokade.domain.listing.dto.ListingUpdateRequest 미러링.
export interface ListingUpdateRequest {
  price: number;
}

// POST/PUT /api/listings 응답 — com.pokade.domain.listing.dto.ListingResponse 미러링.
export interface ListingResponse {
  id: number;
  cardId: number;
  sellerId: number;
  variantId: number | null;
  price: number;
  grade: ListingGrade | null;
  status: ListingStatus;
  createdAt: string;
}
