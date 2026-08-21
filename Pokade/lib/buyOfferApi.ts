import { apiPost } from "@/lib/apiClient";
import { BuyOfferCreateRequest, BuyOfferResponse } from "@/types/price";

// POST /api/buy-offers — 구매입찰 등록. 인증 필요(Authorization 헤더는 apiClient가 자동 첨부).
export async function createBuyOffer(request: BuyOfferCreateRequest): Promise<BuyOfferResponse> {
  return apiPost<BuyOfferResponse>("/api/buy-offers", request);
}
