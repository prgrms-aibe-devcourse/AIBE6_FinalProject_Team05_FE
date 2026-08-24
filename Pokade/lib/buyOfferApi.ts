import { apiGet, apiPost, PageResponse } from "@/lib/apiClient";
import { BuyOfferReadyRequest, BuyOfferReadyResponse, BuyOfferResponse, MyBuyOfferResponse } from "@/types/price";
import { TradeResponse } from "@/types/trade";

// POST /api/buy-offers/ready — 구매입찰 결제창을 띄우기 전, 주문을 먼저 PENDING으로 만든다.
// 구매입찰은 매물처럼 잠글 기존 리소스가 없어 이 시점에 바로 등록 정보(카드/등급/가격/받는사람)를
// 함께 보낸다 - 결제가 실제로 승인돼야 구매입찰이 생성된다. 인증 필요.
export async function readyBuyOffer(request: BuyOfferReadyRequest): Promise<BuyOfferReadyResponse> {
  return apiPost<BuyOfferReadyResponse>("/api/buy-offers/ready", request);
}

// POST /api/buy-offers/confirm-payment — 토스 결제창 successUrl 리다이렉트 쿼리
// (paymentKey/orderId/amount)를 그대로 전달한다. 결제 승인 후 구매입찰을 생성한다. 인증 필요.
// paymentKey는 옵션 — 포인트로 전액을 충당해 결제금액이 0원인 주문은 토스 결제 자체가 없어
// paymentKey 없이 바로 이 함수를 호출한다(BE도 이 경우 paymentKey 없이 승인을 허용한다).
export async function confirmBuyOfferPayment(
  orderId: string,
  amount: number,
  paymentKey?: string,
): Promise<BuyOfferResponse> {
  return apiPost<BuyOfferResponse>("/api/buy-offers/confirm-payment", {
    paymentKey,
    orderId,
    amount,
  });
}

export interface BuyOfferFulfillRequest {
  settlementBankName: string;
  settlementAccountNumber: string;
  settlementAccountHolder: string;
  returnRecipientName: string;
  returnRecipientPhone: string;
  returnAddress: string;
}

// POST /api/buy-offers/{buyOfferId}/fulfill — 즉시판매(구매입찰 체결). 결제는 이미 그 구매입찰
// 등록 시점에 끝나 있어 여기서는 정산계좌·반송주소만 받아 바로 거래(Trade)를 만든다. 인증 필요.
export async function fulfillBuyOffer(
  buyOfferId: number,
  request: BuyOfferFulfillRequest,
): Promise<TradeResponse> {
  return apiPost<TradeResponse>(`/api/buy-offers/${buyOfferId}/fulfill`, request);
}

// GET /api/buy-offers/me?status=&page=&size= — 내 구매입찰 페이징 조회 (인증 필요).
// status 생략 시 전체 상태 조회, page는 0-indexed(Spring Pageable 관례) — fetchMyListings와 동일한 컨벤션.
export async function fetchMyBuyOffers(
  status?: string,
  page = 0,
  size = 10,
): Promise<PageResponse<MyBuyOfferResponse>> {
  const query = new URLSearchParams({ page: String(page), size: String(size) });
  if (status) query.set("status", status);
  return apiGet<PageResponse<MyBuyOfferResponse>>(`/api/buy-offers/me?${query.toString()}`);
}
