import { apiDelete, apiGet, apiPost, apiPostForm, apiPut } from "@/lib/apiClient";
import {
  PortfolioAnalyticsResponse,
  PortfolioItemAddRequest,
  PortfolioItemPnlResponse,
  PortfolioItemResponse,
  PortfolioItemUpdateRequest,
  PortfolioSetCompletionResponse,
  PortfolioSummaryResponse,
} from "@/types/portfolio";

// GET /api/portfolio — 로그인한 유저의 도감(보유 카드) 목록. 페이지네이션 없음(전체 배열), 인증 필요(401 가능).
export async function fetchPortfolio(): Promise<PortfolioItemResponse[]> {
  return apiGet<PortfolioItemResponse[]>("/api/portfolio");
}

// POST /api/portfolio — 존재하지 않는 cardId/variantId면 404(CARD_NOT_FOUND).
export async function addPortfolioItem(
  request: PortfolioItemAddRequest,
): Promise<PortfolioItemResponse> {
  return apiPost<PortfolioItemResponse>("/api/portfolio", request);
}

// PUT /api/portfolio/{id} — 본인 소유가 아니거나 없는 id면 404(PORTFOLIO_ITEM_NOT_FOUND).
export async function updatePortfolioItem(
  id: number,
  request: PortfolioItemUpdateRequest,
): Promise<PortfolioItemResponse> {
  return apiPut<PortfolioItemResponse>(`/api/portfolio/${id}`, request);
}

// DELETE /api/portfolio/{id} — 본인 소유가 아니거나 없는 id면 404(PORTFOLIO_ITEM_NOT_FOUND).
export async function deletePortfolioItem(id: number): Promise<void> {
  return apiDelete(`/api/portfolio/${id}`);
}

// POST /api/portfolio/{id}/thumbnail — 표지 사진 교체(jpg/png, 5MB 이하). AI 진단 등록 여부와 무관하게 항상 가능.
// 본인 소유가 아니거나 없는 id면 404(PORTFOLIO_ITEM_NOT_FOUND), 5MB 초과 시 413(FILE_TOO_LARGE),
// jpg/png가 아니면 400(UNSUPPORTED_IMAGE_TYPE).
export async function updatePortfolioItemThumbnail(
  id: number,
  file: File,
): Promise<PortfolioItemResponse> {
  const formData = new FormData();
  formData.append("image", file);
  return apiPostForm<PortfolioItemResponse>(`/api/portfolio/${id}/thumbnail`, formData);
}

// GET /api/portfolio/summary — 총 평가액 + 전일 대비 등락(등락액·등락률). 시세 없는 항목은 계산에서 제외.
export async function fetchPortfolioSummary(): Promise<PortfolioSummaryResponse> {
  return apiGet<PortfolioSummaryResponse>("/api/portfolio/summary");
}

// GET /api/portfolio/{id}/pnl — 취득가 대비 현재 시세 손익. 취득가 미입력 시 400(PORTFOLIO_ACQUIRED_PRICE_REQUIRED),
// 시세 정보가 없으면 404(PORTFOLIO_PRICE_NOT_FOUND).
export async function fetchPortfolioPnl(id: number): Promise<PortfolioItemPnlResponse> {
  return apiGet<PortfolioItemPnlResponse>(`/api/portfolio/${id}/pnl`);
}

// GET /api/portfolio/analytics — 보유 수량 기준 세트별·레어도별 구성 비율(내림차순). 시세 유무와 무관하게
// 항상 계산되며, 보유 카드가 하나도 없을 때만 bySet/byRarity 모두 빈 배열.
export async function fetchPortfolioAnalytics(): Promise<PortfolioAnalyticsResponse> {
  return apiGet<PortfolioAnalyticsResponse>("/api/portfolio/analytics");
}

// GET /api/portfolio/set-completion — 보유한 세트별 수집 완성도(완성도 내림차순). expansion 정보가 없는
// 카드는 전체 카드 수를 알 수 없어 제외되며, 그런 카드만 있으면 빈 배열.
export async function fetchPortfolioSetCompletion(): Promise<PortfolioSetCompletionResponse[]> {
  return apiGet<PortfolioSetCompletionResponse[]>("/api/portfolio/set-completion");
}

// POST /api/portfolio/from-grade/{resultId} — AI 진단 결과(FR-AI-04)를 도감에 등록.
// 정상 산출(SUCCESS)이 아니면 400(GRADE_RESULT_NOT_REGISTRABLE), 본인 결과가 아니면 403(ACCESS_DENIED),
// 이미 등록된 결과면 409(GRADE_RESULT_ALREADY_REGISTERED), 카드를 해석하지 못하면 404(CARD_NOT_FOUND).
// override — AI가 카드를 인식하지 못했거나 잘못 인식했을 때 사용자가 직접 고른 카드로 등록하기 위해 전달.
export async function addPortfolioItemFromGrade(
  resultId: number,
  override?: { cardId: number; variantId?: number },
): Promise<PortfolioItemResponse> {
  return apiPost<PortfolioItemResponse>(`/api/portfolio/from-grade/${resultId}`, override);
}
