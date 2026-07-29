import { apiGet, PageResponse } from "@/lib/apiClient";
import { CardDetailResponse, CardResponse } from "@/types/card";

// GET /api/cards — types/rarity/expansionId 정확 일치 필터 (기본 페이지 size=20).
export interface CardSearchFilters {
  expansionId?: string;
  types?: string[];
  rarity?: string[];
}

export async function fetchCards(filters: CardSearchFilters = {}): Promise<CardResponse[]> {
  const query = new URLSearchParams();
  if (filters.expansionId) query.set("expansionId", filters.expansionId);
  if (filters.types?.length) query.set("types", filters.types.join(","));
  if (filters.rarity?.length) query.set("rarity", filters.rarity.join(","));
  const qs = query.toString();
  const page = await apiGet<PageResponse<CardResponse>>(`/api/cards${qs ? `?${qs}` : ""}`);
  return page.content;
}

// GET /api/cards/search?q= — 이름 키워드 검색. q가 blank면 BE가 400(INVALID_INPUT) 반환.
export async function fetchCardsByKeyword(q: string): Promise<CardResponse[]> {
  const page = await fetchCardsByKeywordPage(q);
  return page.content;
}

// 헤더 자동완성용 — totalElements까지 필요할 때 페이지 응답 전체를 반환.
export async function fetchCardsByKeywordPage(q: string): Promise<PageResponse<CardResponse>> {
  const query = new URLSearchParams({ q });
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
