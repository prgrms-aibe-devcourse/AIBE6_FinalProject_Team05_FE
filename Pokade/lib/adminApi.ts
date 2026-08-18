import { apiGet, apiPatch, PageResponse } from "@/lib/apiClient";
import { AdminDashboardResponse, AdminMetricsPeriod } from "@/types/adminMetrics";
import { ReportResponse } from "@/types/adminReport";
import { InquiryCategory, InquiryResponse, InquiryStatus } from "@/types/inquiry";

// GET /api/admin/metrics/dashboard — ADMIN 권한 필요(401/403 가능). period는 차트(시리즈)에만 적용된다.
export async function fetchAdminDashboard(period: AdminMetricsPeriod): Promise<AdminDashboardResponse> {
  return apiGet<AdminDashboardResponse>(`/api/admin/metrics/dashboard?period=${period}`);
}

// GET /api/admin/reports — 매물 신고 목록 조회 (ADMIN 권한 필요). 신고 없으면 빈 배열.
export async function fetchListingReports(): Promise<ReportResponse[]> {
  return apiGet<ReportResponse[]>("/api/admin/reports");
}

// PATCH /api/admin/listings/{id}/hide — 신고 검토 후 매물 숨김 처리 (ADMIN 권한 필요).
// 이미 숨김 처리된 매물이면 400, 없으면 404.
export async function hideListing(listingId: number): Promise<void> {
  await apiPatch<void>(`/api/admin/listings/${listingId}/hide`);
}

// GET /api/admin/inquiries — 전체 1:1 문의 목록, 최신순, 페이지네이션 (ADMIN 권한 필요).
// page는 0-based(BE Pageable 그대로). category 생략 시 전체 조회.
export async function fetchInquiries(params: {
  category?: InquiryCategory;
  page?: number;
  size?: number;
}): Promise<PageResponse<InquiryResponse>> {
  const query = new URLSearchParams();
  if (params.category) query.set("category", params.category);
  query.set("page", String(params.page ?? 0));
  query.set("size", String(params.size ?? 20));
  return apiGet<PageResponse<InquiryResponse>>(`/api/admin/inquiries?${query.toString()}`);
}

// GET /api/admin/inquiries/{id} — 문의 상세 (ADMIN 권한 필요). 없으면 404.
export async function fetchInquiry(id: number): Promise<InquiryResponse> {
  return apiGet<InquiryResponse>(`/api/admin/inquiries/${id}`);
}

// PATCH /api/admin/inquiries/{id}/status — 처리 상태 변경 (ADMIN 권한 필요). 없으면 404.
export async function updateInquiryStatus(id: number, status: InquiryStatus): Promise<InquiryResponse> {
  return apiPatch<InquiryResponse>(`/api/admin/inquiries/${id}/status`, { status });
}
