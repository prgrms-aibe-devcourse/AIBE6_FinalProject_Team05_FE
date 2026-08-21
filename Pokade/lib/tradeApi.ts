import { apiGet, apiPatch, apiPost, PageResponse } from "@/lib/apiClient";
import {
  MyTradeResponse,
  TradeReadyResponse,
  TradeResponse,
  TradeRole,
  TradeStatus,
} from "@/types/trade";

export interface TradeRecipientInfo {
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
}

// POST /api/trades/ready — 즉시구매 결제창을 띄우기 전, 주문을 먼저 PENDING으로 만든다.
// 이 시점엔 매물을 잠그지 않는다 - 결제를 실제로 완료해야 매물이 잠기고 거래가 생성된다. 인증 필요.
// 받는사람 정보(주문서 단계에서 입력)를 함께 보내면 amount에 고정 배송비가 포함되어 돌아온다.
// pointsToUse만큼 결제 전에 미리 차감되어, 응답 amount는 그만큼 뺀 실제 결제(토스) 금액이다.
export async function readyTradePurchase(
  listingId: number,
  pointsToUse: number,
  recipient: TradeRecipientInfo,
): Promise<TradeReadyResponse> {
  return apiPost<TradeReadyResponse>("/api/trades/ready", { listingId, pointsToUse, ...recipient });
}

// POST /api/trades/confirm-payment — 토스 결제창 successUrl 리다이렉트 쿼리(paymentKey/orderId/amount)를
// 그대로 전달한다. 결제 승인 후 매물을 잠그고 거래를 생성한다. 인증 필요.
// paymentKey는 옵션 — 포인트로 전액을 충당해 결제금액이 0원인 주문은 토스 결제 자체가 없어
// paymentKey 없이 바로 이 함수를 호출한다(BE도 이 경우 paymentKey 없이 승인을 허용한다).
export async function confirmTradePurchase(
  orderId: string,
  amount: number,
  paymentKey?: string,
): Promise<TradeResponse> {
  return apiPost<TradeResponse>("/api/trades/confirm-payment", { paymentKey, orderId, amount });
}

// GET /api/trades/{id} — 거래 조회. 본인(구매자/판매자) 아니면 403, 없으면 404.
export async function fetchTrade(tradeId: number): Promise<TradeResponse> {
  return apiGet<TradeResponse>(`/api/trades/${tradeId}`);
}

// PATCH /api/trades/{id}/ship — 판매자가 플랫폼으로 발송 처리(판매자만 가능).
export async function shipTrade(tradeId: number): Promise<TradeResponse> {
  return apiPatch<TradeResponse>(`/api/trades/${tradeId}/ship`);
}

// PATCH /api/trades/{id}/confirm — 거래 확정(구매자만 가능).
export async function confirmTrade(tradeId: number): Promise<TradeResponse> {
  return apiPatch<TradeResponse>(`/api/trades/${tradeId}/confirm`);
}

// PATCH /api/trades/{id}/cancel — 거래 취소(구매자·판매자 둘 다 가능).
export async function cancelTrade(tradeId: number): Promise<TradeResponse> {
  return apiPatch<TradeResponse>(`/api/trades/${tradeId}/cancel`);
}

// GET /api/users/me/trades — 마이페이지 거래 내역. 인증 필요.
// role 미지정이면 구매·판매 전체, statuses 미지정이면 전체 상태.
export async function fetchMyTrades(params: {
  role?: TradeRole;
  statuses?: TradeStatus[];
  page?: number; // 0-indexed(Spring Pageable 관례)
  size?: number;
}): Promise<PageResponse<MyTradeResponse>> {
  const query = new URLSearchParams();
  if (params.role) query.set("role", params.role);
  // 서버는 콤마 다중값을 받는다 — '진행중' 같은 묶음의 정의는 화면 사정이라 FE가 갖는다.
  if (params.statuses?.length) query.set("status", params.statuses.join(","));
  if (params.page) query.set("page", String(params.page));
  if (params.size) query.set("size", String(params.size));

  const qs = query.toString();
  return apiGet<PageResponse<MyTradeResponse>>(`/api/users/me/trades${qs ? `?${qs}` : ""}`);
}
