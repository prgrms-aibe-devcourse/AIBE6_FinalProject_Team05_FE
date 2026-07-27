import { apiGet, PageResponse } from "@/lib/apiClient";
import { CardResponse } from "@/types/card";

// GET /api/cards — 필터 없는 전체 목록 조회 (기본 페이지 size=20).
export async function fetchCards(): Promise<CardResponse[]> {
  const page = await apiGet<PageResponse<CardResponse>>("/api/cards");
  return page.content;
}
