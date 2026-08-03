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

// POST /api/listings 요청 바디 — com.pokade.domain.listing.dto.ListingCreateRequest 미러링.
// imageUrls는 최소 1개 필요(BE @NotEmpty), 별도 업로드 기능 없이 URL을 직접 입력받는다.
export interface ListingCreateRequest {
  cardId: number;
  variantId?: number;
  price: number;
  grade?: ListingGrade;
  imageUrls: string[];
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
  imageUrls: string[];
  createdAt: string;
}
