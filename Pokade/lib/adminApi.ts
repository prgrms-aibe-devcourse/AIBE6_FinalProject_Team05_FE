import { apiDelete, apiGet, apiPatch, PageResponse } from "@/lib/apiClient";
import { AdminUserResponse } from "@/types/adminUser";
import { UserRole, UserStatus } from "@/types/auth";
import { AdminDashboardResponse, AdminMetricsPeriod } from "@/types/adminMetrics";
import { ReportResponse } from "@/types/adminReport";
import { AdminTradeResponse } from "@/types/adminTrade";
import { TradeResponse } from "@/types/trade";
import { InquiryCategory, InquiryResponse, InquiryStatus } from "@/types/inquiry";

// GET /api/admin/metrics/dashboard — ADMIN 권한 필요(401/403 가능). period는 차트(시리즈)에만 적용된다.
export async function fetchAdminDashboard(
  period: AdminMetricsPeriod,
): Promise<AdminDashboardResponse> {
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
export async function fetchPendingTrades(): Promise<AdminTradeResponse[]> {
  return apiGet<AdminTradeResponse[]>("/api/admin/trades");
}

// GET /api/admin/trades/{id} — 거래 상세(현재 진행 상황) 조회. 거래 번호 클릭 시 모달용.
export async function fetchAdminTrade(tradeId: number): Promise<AdminTradeResponse> {
  return apiGet<AdminTradeResponse>(`/api/admin/trades/${tradeId}`);
}

// PATCH /api/admin/trades/{id}/inspect — 검수 완료 처리 (SHIPPED_TO_PLATFORM → INSPECTED).
// 이 두 액션은 여전히 TradeResponse를 반환한다(닉네임 불필요 - 목록/상세 조회 쪽만 AdminTradeResponse).
export async function inspectTrade(tradeId: number): Promise<TradeResponse> {
  return apiPatch<TradeResponse>(`/api/admin/trades/${tradeId}/inspect`);
}

// PATCH /api/admin/trades/{id}/deliver — 배송 완료 처리 (INSPECTED → DELIVERED).
export async function deliverTrade(tradeId: number): Promise<TradeResponse> {
  return apiPatch<TradeResponse>(`/api/admin/trades/${tradeId}/deliver`);
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
export async function updateInquiryStatus(
  id: number,
  status: InquiryStatus,
): Promise<InquiryResponse> {
  return apiPatch<InquiryResponse>(`/api/admin/inquiries/${id}/status`, { status });
}

// PATCH /api/admin/inquiries/{id}/answer — 답변 등록/수정 (ADMIN 권한 필요). 성공 시 상태가 HANDLED로 자동 전환된다. 없으면 404.
export async function answerInquiry(id: number, content: string): Promise<InquiryResponse> {
  return apiPatch<InquiryResponse>(`/api/admin/inquiries/${id}/answer`, { content });
}

// GET /api/admin/users — 회원 목록 (ADMIN 권한 필요). 상태·역할 필터와 이메일·닉네임 검색을 조합한다.
// 서버 기본 정렬은 가입일 내림차순이다.
export async function fetchAdminUsers(params: {
  status?: UserStatus;
  role?: UserRole;
  keyword?: string;
  page?: number;
  size?: number;
}): Promise<PageResponse<AdminUserResponse>> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.role) query.set("role", params.role);
  if (params.keyword) query.set("keyword", params.keyword);
  query.set("page", String(params.page ?? 0));
  query.set("size", String(params.size ?? 20));
  return apiGet<PageResponse<AdminUserResponse>>(`/api/admin/users?${query.toString()}`);
}

// PATCH /api/admin/users/{id}/suspend — 계정 정지. 활성 계정만 가능(그 외 400).
export async function suspendUser(userId: number): Promise<void> {
  await apiPatch<void>(`/api/admin/users/${userId}/suspend`);
}

// PATCH /api/admin/users/{id}/unsuspend — 정지 해제. 정지 상태가 아니면 400.
export async function unsuspendUser(userId: number): Promise<void> {
  await apiPatch<void>(`/api/admin/users/${userId}/unsuspend`);
}

// DELETE /api/admin/users/{id} — 강제 탈퇴. 즉시 확정되며 되돌릴 수 없다(닉네임·이메일 익명화).
export async function forceWithdrawUser(userId: number): Promise<void> {
  await apiDelete(`/api/admin/users/${userId}`);
}
