import { apiPostRaw } from "@/lib/apiClient";

// POST /api/analytics/visits — 인증 불필요, 어드민 대시보드 방문 수 집계용.
export async function recordVisit(): Promise<void> {
  await apiPostRaw<void>("/api/analytics/visits");
}
