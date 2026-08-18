import { apiGet, apiPatch } from "@/lib/apiClient";
import { AdminDashboardResponse, AdminMetricsPeriod } from "@/types/adminMetrics";
import { ReportResponse } from "@/types/adminReport";
import { TradeResponse } from "@/types/trade";

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

// GET /api/admin/trades — 검수/배송 대기 거래 목록 조회 (ADMIN 권한 필요).
// SHIPPED_TO_PLATFORM(검수 대기)·INSPECTED(배송 대기) 거래만 내려준다. 대기 중인 거래 없으면 빈 배열.
export async function fetchPendingTrades(): Promise<TradeResponse[]> {
  return apiGet<TradeResponse[]>("/api/admin/trades");
}

// PATCH /api/admin/trades/{id}/inspect — 검수 완료 처리 (SHIPPED_TO_PLATFORM → INSPECTED).
export async function inspectTrade(tradeId: number): Promise<TradeResponse> {
  return apiPatch<TradeResponse>(`/api/admin/trades/${tradeId}/inspect`);
}

// PATCH /api/admin/trades/{id}/deliver — 배송 완료 처리 (INSPECTED → DELIVERED).
export async function deliverTrade(tradeId: number): Promise<TradeResponse> {
  return apiPatch<TradeResponse>(`/api/admin/trades/${tradeId}/deliver`);
}
