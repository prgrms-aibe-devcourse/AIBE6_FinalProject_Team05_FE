import { apiGet, apiGetRaw, PageResponse } from "@/lib/apiClient";
import { CardDetailResponse, CardResponse } from "@/types/card";
import { ListingSummaryResponse, PriceSummaryResponse, TradeSummaryResponse } from "@/types/price";

// BE 화이트리스트(SORT_COLUMN_WHITELIST)와 일치 — 그 외 값은 BE가 latest로 폴백.
// "popular"은 view_count 기준(feature/#62에서 BE 지원 확인).
export type CardSort = "latest" | "name" | "popular";

// GET /api/cards — types/rarity/expansionId 정확 일치 필터 (기본 페이지 size=20).
export interface CardSearchFilters {
  expansionId?: string;
  types?: string[];
  rarity?: string[];
  sort?: CardSort;
  page?: number; // 0-indexed(Spring Pageable 관례)
  size?: number;
}

function appendPagination(query: URLSearchParams, page?: number, size?: number): void {
  if (page) query.set("page", String(page));
  if (size) query.set("size", String(size));
}

// totalPages/totalElements까지 필요할 때(페이지네이션 UI) 페이지 응답 전체를 반환.
export async function fetchCardsPage(
  filters: CardSearchFilters = {},
): Promise<PageResponse<CardResponse>> {
  const query = new URLSearchParams();
  if (filters.expansionId) query.set("expansionId", filters.expansionId);
  if (filters.types?.length) query.set("types", filters.types.join(","));
  if (filters.rarity?.length) query.set("rarity", filters.rarity.join(","));
  if (filters.sort) query.set("sort", filters.sort);
  appendPagination(query, filters.page, filters.size);
  const qs = query.toString();
  return apiGet<PageResponse<CardResponse>>(`/api/cards${qs ? `?${qs}` : ""}`);
}

export async function fetchCards(filters: CardSearchFilters = {}): Promise<CardResponse[]> {
  const page = await fetchCardsPage(filters);
  return page.content;
}

// GET /api/cards/search?q= — 이름 키워드 검색. q가 blank면 BE가 400(INVALID_INPUT) 반환.
// BE에 sort 파라미터가 없어(고정 정렬) 정렬 옵션은 받지 않는다.
export async function fetchCardsByKeyword(q: string): Promise<CardResponse[]> {
  const page = await fetchCardsByKeywordPage(q);
  return page.content;
}

// 헤더 자동완성 / 검색 결과 페이지네이션용 — totalElements까지 필요할 때 페이지 응답 전체를 반환.
export async function fetchCardsByKeywordPage(
  q: string,
  page?: number,
  size?: number,
): Promise<PageResponse<CardResponse>> {
  const query = new URLSearchParams({ q });
  appendPagination(query, page, size);
  return apiGet<PageResponse<CardResponse>>(`/api/cards/search?${query.toString()}`);
}

// GET /api/cards/{id} — 카드 상세 조회. 카드가 없으면 ApiError(status=404).
export async function fetchCardDetail(id: number): Promise<CardDetailResponse> {
  return apiGet<CardDetailResponse>(`/api/cards/${id}`);
}

// GET /api/cards/{id}/related — 비슷한 카드 목록 조회.
export async function fetchRelatedCards(id: number): Promise<CardResponse[]> {
  return apiGet<CardResponse[]>(`/api/cards/${id}/related`);
}

// GET /api/prices/{cardId}/summary — 현재가(즉시구매가/판매호가) 조회. 매물/구매호가가 없으면 각 필드 null.
// variantId 생략 시 BE가 대표 판본(primary) 기준으로 응답한다.
export async function fetchPriceSummary(
  cardId: number,
  variantId?: number,
): Promise<PriceSummaryResponse> {
  const query = variantId != null ? `?variantId=${variantId}` : "";
  return apiGet<PriceSummaryResponse>(`/api/prices/${cardId}/summary${query}`);
}

// GET /api/prices/{cardId}/trades — 최근 체결 내역 (최대 20건, 서버 고정, 최신순).
export async function fetchRecentTrades(cardId: number): Promise<TradeSummaryResponse[]> {
  return apiGet<TradeSummaryResponse[]>(`/api/prices/${cardId}/trades`);
}

// GET /api/listings?cardId= — 판매 중(ACTIVE) 매물 목록, 가격 오름차순.
// 다른 API와 달리 ApiResponse 래퍼 없이 raw 배열을 그대로 반환하므로 apiGetRaw 사용.
export async function fetchActiveListings(cardId: number): Promise<ListingSummaryResponse[]> {
  return apiGetRaw<ListingSummaryResponse[]>(`/api/listings?cardId=${cardId}`);
}
