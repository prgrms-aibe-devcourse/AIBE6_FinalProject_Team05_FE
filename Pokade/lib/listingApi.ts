import { apiPostRaw } from "@/lib/apiClient";
import { ListingCreateRequest, ListingResponse } from "@/types/price";

// POST /api/listings — 매물 등록. 인증 필요(Authorization 헤더는 apiClient가 자동 첨부).
// raw 응답(ApiResponse 래퍼 없음)이라 apiPostRaw 사용.
export async function createListing(request: ListingCreateRequest): Promise<ListingResponse> {
  return apiPostRaw<ListingResponse>("/api/listings", request);
}
