import { apiDeleteRaw, apiGetRaw, apiPostRaw, apiPutRaw } from "@/lib/apiClient";
import {
  ListingCreateRequest,
  ListingResponse,
  ListingStatus,
  ListingSummaryResponse,
  ListingUpdateRequest,
} from "@/types/price";

// POST /api/listings — 매물 등록. 인증 필요(Authorization 헤더는 apiClient가 자동 첨부).
// raw 응답(ApiResponse 래퍼 없음)이라 apiPostRaw 사용.
export async function createListing(request: ListingCreateRequest): Promise<ListingResponse> {
  return apiPostRaw<ListingResponse>("/api/listings", request);
}

// GET /api/listings/me?status= — 내 매물 조회 (인증 필요). status 생략 시 전체 상태 조회.
export async function fetchMyListings(status?: ListingStatus): Promise<ListingSummaryResponse[]> {
  const query = status ? `?status=${status}` : "";
  return apiGetRaw<ListingSummaryResponse[]>(`/api/listings/me${query}`);
}

// PUT /api/listings/{id} — 매물 가격 수정. 본인 소유 + ACTIVE 상태에서만 가능(그 외 400/403/404).
export async function updateListingPrice(
  listingId: number,
  request: ListingUpdateRequest,
): Promise<ListingResponse> {
  return apiPutRaw<ListingResponse>(`/api/listings/${listingId}`, request);
}

// DELETE /api/listings/{id} — 매물 삭제(soft delete, status→CANCELLED). 204 No Content.
export async function deleteListing(listingId: number): Promise<void> {
  return apiDeleteRaw(`/api/listings/${listingId}`);
}
