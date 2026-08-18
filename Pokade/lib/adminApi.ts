import { apiGet } from "@/lib/apiClient";
import { AdminDashboardResponse, AdminMetricsPeriod } from "@/types/adminMetrics";

// GET /api/admin/metrics/dashboard — ADMIN 권한 필요(401/403 가능). period는 차트(시리즈)에만 적용된다.
export async function fetchAdminDashboard(period: AdminMetricsPeriod): Promise<AdminDashboardResponse> {
  return apiGet<AdminDashboardResponse>(`/api/admin/metrics/dashboard?period=${period}`);
}
