import { apiGet } from "@/lib/apiClient";
import { AdminDashboardResponse } from "@/types/adminMetrics";

// GET /api/admin/metrics/dashboard — ADMIN 권한 필요(401/403 가능).
export async function fetchAdminDashboard(): Promise<AdminDashboardResponse> {
  return apiGet<AdminDashboardResponse>("/api/admin/metrics/dashboard");
}
