import { apiGetRaw, PageResponse } from "@/lib/apiClient";
import { GradeResponse } from "@/types/ai";

// GET /api/ai/grade/history — 본인 진단 이력 페이징 조회 (최신순). ApiResponse 래퍼 없이 raw로 응답.
export async function fetchGradeHistory(
  page: number,
  size = 20,
): Promise<PageResponse<GradeResponse>> {
  return apiGetRaw<PageResponse<GradeResponse>>(`/api/ai/grade/history?page=${page}&size=${size}`);
}
