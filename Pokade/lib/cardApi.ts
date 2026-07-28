import { apiGet, PageResponse } from "@/lib/apiClient";
import { CardDetailResponse, CardResponse } from "@/types/card";

// GET /api/cards — 필터 없는 전체 목록 조회 (기본 페이지 size=20).
export async function fetchCards(): Promise<CardResponse[]> {
  const page = await apiGet<PageResponse<CardResponse>>("/api/cards");
  return page.content;
}

// GET /api/cards/{id} — 카드 상세 조회. 카드가 없으면 ApiError(status=404).
export async function fetchCardDetail(id: number): Promise<CardDetailResponse> {
  return apiGet<CardDetailResponse>(`/api/cards/${id}`);
}
