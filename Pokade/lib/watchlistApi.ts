import { apiDelete, apiGet, apiPost } from "@/lib/apiClient";
import { WatchlistCreateRequest, WatchlistResponse } from "@/types/watchlist";

// GET /api/watchlist — 내 워치리스트 목록 (인증 필요). 카드 정보·현재 시세가 이미 함께 채워져서 온다.
export async function fetchWatchlist(): Promise<WatchlistResponse[]> {
  return apiGet<WatchlistResponse[]>("/api/watchlist");
}

// POST /api/watchlist — 관심 카드 등록. 같은 카드 중복 등록 시 409(DUPLICATE_WATCHLIST),
// 20개 초과 시 409(WATCHLIST_LIMIT_EXCEEDED), 목표가 둘 다 없으면 400(TARGET_PRICE_REQUIRED).
export async function addWatchlist(request: WatchlistCreateRequest): Promise<WatchlistResponse> {
  return apiPost<WatchlistResponse>("/api/watchlist", request);
}

// DELETE /api/watchlist/{id} — 워치리스트 항목 삭제. 본인 소유가 아니거나 없으면 404.
export async function deleteWatchlistItem(id: number): Promise<void> {
  return apiDelete(`/api/watchlist/${id}`);
}
