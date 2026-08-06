import { apiGet, apiPatch, apiPost } from "@/lib/apiClient";
import { TradeCreateRequest, TradeResponse } from "@/types/trade";

// POST /api/trades — 즉시구매 요청. 인증 필요. 결제는 BE가 스텁 처리(항상 성공)해서 즉시 매칭됨.
export async function createTrade(request: TradeCreateRequest): Promise<TradeResponse> {
  return apiPost<TradeResponse>("/api/trades", request);
}

// GET /api/trades/{id} — 거래 조회. 본인(구매자/판매자) 아니면 403, 없으면 404.
export async function fetchTrade(tradeId: number): Promise<TradeResponse> {
  return apiGet<TradeResponse>(`/api/trades/${tradeId}`);
}

// PATCH /api/trades/{id}/confirm — 거래 확정(구매자만 가능).
export async function confirmTrade(tradeId: number): Promise<TradeResponse> {
  return apiPatch<TradeResponse>(`/api/trades/${tradeId}/confirm`);
}

// PATCH /api/trades/{id}/cancel — 거래 취소(구매자·판매자 둘 다 가능).
export async function cancelTrade(tradeId: number): Promise<TradeResponse> {
  return apiPatch<TradeResponse>(`/api/trades/${tradeId}/cancel`);
}
