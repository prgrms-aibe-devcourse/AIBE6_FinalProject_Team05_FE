import { apiPost } from "@/lib/apiClient";
import { BuyOfferReadyRequest, BuyOfferReadyResponse, BuyOfferResponse } from "@/types/price";

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
