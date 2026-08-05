// 시세 API(BE) 응답 형태 — com.pokade.domain.price.dto.PriceSummaryResponse 미러링.
export interface PriceSummaryResponse {
  buyPrice: number | null;
  sellPrice: number | null;
  currency: string;
}

// GET /api/prices/summaries 배치 응답 항목 — com.pokade.domain.price.dto.CardPriceSummaryResponse 미러링.
export interface CardPriceSummaryResponse {
  cardId: number;
  buyPrice: number | null;
  sellPrice: number | null;
  currency: string;
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
export interface ListingSummaryResponse {
  id: number;
  sellerId: number;
  price: number;
  grade: ListingGrade | null;
  status: ListingStatus;
  thumbnailUrl: string | null;
  createdAt: string;
}
