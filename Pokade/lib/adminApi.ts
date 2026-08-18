import { apiGet, apiPatch } from "@/lib/apiClient";
import { AdminDashboardResponse, AdminMetricsPeriod } from "@/types/adminMetrics";
import { ReportResponse } from "@/types/adminReport";

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
