import { apiDelete, apiGet, apiPost, apiPut, PageResponse } from "@/lib/apiClient";
import {
  ListingCreateRequest,
  ListingResponse,
  ListingStatus,
  ListingSummaryResponse,
  ListingUpdateRequest,
  MyListingResponse,
} from "@/types/price";

// POST /api/listings — 매물 등록. 인증 필요(Authorization 헤더는 apiClient가 자동 첨부).
export async function createListing(request: ListingCreateRequest): Promise<ListingResponse> {
  return apiPost<ListingResponse>("/api/listings", request);
}

export type MyListingsSort = "createdAt,desc" | "createdAt,asc" | "price,asc" | "price,desc";

// GET /api/listings/me?status=&page=&size=&sort= — 내 매물 페이징 조회 (인증 필요).
// status 생략 시 전체 상태 조회, page는 0-indexed(Spring Pageable 관례).
export async function fetchMyListings(
  status?: ListingStatus,
  page = 0,
  size = 10,
  sort: MyListingsSort = "createdAt,desc",
): Promise<PageResponse<ListingSummaryResponse>> {
  const query = new URLSearchParams({ page: String(page), size: String(size), sort });
  if (status) query.set("status", status);
  return apiGet<PageResponse<ListingSummaryResponse>>(`/api/listings/me?${query.toString()}`);
}

// GET /api/listings/{id} — 마이페이지 "입찰"(판매 등록 탭) 항목 클릭 시 보여줄 주문서 상세 (인증 필요, 본인 소유 아니면 403).
export async function fetchMyListing(listingId: number): Promise<MyListingResponse> {
  return apiGet<MyListingResponse>(`/api/listings/${listingId}`);
}

// PUT /api/listings/{id} — 매물 가격/정산계좌/반송주소 수정. 본인 소유 + ACTIVE 상태에서만 가능(그 외
// 400/403/404). 정산계좌/반송주소는 생략 가능(BE가 기존 값 유지) - "내 매물 관리"의 빠른 가격 수정은
// price만 넘긴다.
export async function updateListing(
  listingId: number,
  request: ListingUpdateRequest,
): Promise<ListingResponse> {
  return apiPut<ListingResponse>(`/api/listings/${listingId}`, request);
}

// DELETE /api/listings/{id} — 매물 삭제(soft delete, status→CANCELLED).
export async function deleteListing(listingId: number): Promise<void> {
  return apiDelete(`/api/listings/${listingId}`);
}
