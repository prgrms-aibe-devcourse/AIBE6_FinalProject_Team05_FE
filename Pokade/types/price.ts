// 시세 API(BE) 응답 형태 — com.pokade.domain.price.dto.PriceSummaryResponse 미러링.
export interface PriceSummaryResponse {
  buyPrice: number | null;
  sellPrice: number | null;
  currency: string;
}

// GET /api/prices/summaries 배치 응답 항목 — com.pokade.domain.price.dto.CardPriceSummaryResponse 미러링.
// recentTradePrice: includeRecentTradePrice=true로 요청했을 때만 채워짐(해당 grade 기준 최근 체결가).
// marketPrice: card_prices의 비등급(raw) 시세 - buyPrice/recentTradePrice가 둘 다 없는 카드용 fallback.
// buyPrice/sellPrice/recentTradePrice와 달리 KRW가 아니라 marketPriceCurrency(USD/JPY 등) 기준이라 별도 통화 필드로 옴.
// BE는 marketPrice/marketPriceCurrency를 항상 같이 채우거나 같이 비워두므로, 둘이 따로 존재할 수 없게 타입으로도 표현한다.
export type CardPriceSummaryResponse = {
  cardId: number;
  buyPrice: number | null;
  sellPrice: number | null;
  currency: string;
  recentTradePrice?: number | null;
} & (
  | { marketPrice: number; marketPriceCurrency: string }
  | { marketPrice?: null; marketPriceCurrency?: null }
);

// 매물/체결 등급 — com.pokade.domain.listing.ListingGrade 미러링.
// AI 등급진단 도메인의 Grade("S"|"A"|"B")와는 별개 개념(판매자가 매물 등록 시 직접 표기하는 등급).
export type ListingGrade = "S" | "A" | "B" | "PSA10" | "PSA9" | "PSA8";

// ListingGrade + 미등급(RAW, BE에서는 grade=null) — 카드 상세 화면(등급 선택 박스/구매·판매입찰 탭)에서
// "등급 없음"도 하나의 선택지로 다뤄야 하는 곳에서 공용으로 쓴다.
export type GradeKey = ListingGrade | "RAW";

// PSA10 > PSA9 > PSA8 > S > A > B > 미등급 순 — 등급 선택 박스/구매·판매입찰 탭에서 공통으로 쓰는 표시 순서.
export const GRADE_ORDER: GradeKey[] = ["PSA10", "PSA9", "PSA8", "S", "A", "B", "RAW"];

export const GRADE_LABELS: Record<GradeKey, string> = {
  PSA10: "PSA 10",
  PSA9: "PSA 9",
  PSA8: "PSA 8",
  S: "S",
  A: "A",
  B: "B",
  RAW: "미등급",
};

// com.pokade.domain.price.dto.TradeSummaryResponse 미러링.
export interface TradeSummaryResponse {
  tradedAt: string;
  price: number;
  grade: ListingGrade | null;
}

// com.pokade.domain.price.ChartPeriod 미러링 — GET /api/prices/{cardId}/chart?period= 값.
export type ChartPeriod = "7d" | "30d" | "90d" | "180d";

// com.pokade.domain.price.dto.CardPricePointResponse 미러링 — GET /api/prices/{cardId}/grade-chart 응답 항목.
// 실제 체결 이력이 아니라 card_prices의 market을 change_*_pct로 거슬러 올라간 추정가 포인트.
// price의 통화는 currency 그대로(USD/JPY일 수 있음, TradeSummaryResponse처럼 KRW로 고정돼 있지 않음).
export interface CardPricePointResponse {
  date: string;
  price: number;
  currency: string;
}

// com.pokade.domain.price.dto.PriceStatsResponse 미러링 — GET /api/prices/{cardId}/stats.
// changeRate(%)·changeAmount(원)는 최근 7일 vs 이전 7일 S등급 평균 체결가 비교, 데이터 부족 시 둘 다 0.
// volume: 최근 7일 S등급 체결 건수.
export interface PriceStatsResponse {
  changeRate: number;
  changeAmount: number;
  volume: number;
}

// com.pokade.domain.price.RankingType 미러링 — GET /api/prices/ranking?type= 값.
export type RankingType = "rise" | "fall";

// com.pokade.domain.price.dto.PriceRankingResponse 미러링 — GET /api/prices/ranking 응답 항목.
// changeRate(%)·changeAmount(원)는 PriceStatsResponse와 동일하게 최근 7일 vs 이전 7일
// S등급 평균 체결가 비교 기준(둘 중 한쪽이라도 데이터가 없으면 해당 카드는 응답에서 제외됨).
export interface PriceRankingResponse {
  cardId: number;
  cardName: string | null;
  // 한글 매핑이 없으면 null(어설픈 오번역보다 안전하다는 BE 쪽 설계, watchlist.ts와 동일).
  // 표시할 땐 cardNameKo ?? cardName.
  cardNameKo: string | null;
  imageUrl: string | null;
  price: number;
  changeRate: number;
  changeAmount: number;
}

// com.pokade.domain.price.dto.DailyMarketStatResponse 미러링 — 일별 거래 현황 한 포인트.
// medianPrice: 그 날 체결이 하나도 없으면 null.
export interface DailyMarketStatResponse {
  date: string;
  volume: number;
  medianPrice: number | null;
}

// com.pokade.domain.price.dto.MarketOverviewResponse 미러링 — GET /api/prices/market-overview 응답.
// 카드/등급 구분 없이 플랫폼 전체 체결 기준 - PriceRankingResponse(카드별 평균가 등락률)와는 별개 지표다.
// 거래가는 평균이 아니라 중간값(median)으로 계산해서 소수의 초고가/초저가 체결에 덜 흔들린다.
// volumeChangeRate/medianChangeRate*는 비교 대상 시점에 거래가 없어 비교 자체가 불가능하면 null.
export interface MarketOverviewResponse {
  todayVolume: number;
  volumeChangeRate: number | null;
  volumeChangeAmount: number;
  todayMedianPrice: number | null;
  medianChangeRate1d: number | null;
  medianChangeAmount1d: number | null;
  medianChangeRate7d: number | null;
  medianChangeRate30d: number | null;
  totalVolume: number;
  dailyStats: DailyMarketStatResponse[];
}

// com.pokade.domain.listing.ListingStatus 미러링.
export type ListingStatus = "ACTIVE" | "TRADING" | "SOLD" | "EXPIRED" | "CANCELLED" | "HIDDEN";

// com.pokade.domain.listing.dto.ListingSummaryResponse 미러링.
// cardId/cardName은 "내 매물" 화면에서 카드 상세로 연결하기 위해 BE에 추가 요청해 받은 필드.
// 매물 사진은 없음 — 매칭은 플랫폼이 중개하므로 실물 사진을 보여줄 필요가 없어 제외.
export interface ListingSummaryResponse {
  id: number;
  sellerId: number;
  cardId: number;
  cardName: string | null;
  price: number;
  grade: ListingGrade | null;
  status: ListingStatus;
  createdAt: string;
  tradeId: number | null;
}

// POST /api/listings 요청 바디 — com.pokade.domain.listing.dto.ListingCreateRequest 미러링.
// 정산계좌/반송주소 6개 필드는 "주문서" 단계(app/listings/new/order)에서 입력받아 이 시점에 함께 보낸다.
export interface ListingCreateRequest {
  cardId: number;
  variantId?: number;
  price: number;
  grade: ListingGrade;
  settlementBankName: string;
  settlementAccountNumber: string;
  settlementAccountHolder: string;
  returnRecipientName: string;
  returnRecipientPhone: string;
  returnAddress: string;
}

// PUT /api/listings/{id} 요청 바디 — com.pokade.domain.listing.dto.ListingUpdateRequest 미러링.
export interface ListingUpdateRequest {
  price: number;
}

// GET /api/prices/{cardId}/buy-offers 응답 항목 — com.pokade.domain.price.dto.BuyOfferOrderbookEntryResponse 미러링.
// 활성 구매입찰(매수 호가)을 가격 내림차순으로 반환 — 판매 매물의 OrderbookEntryResponse/ListingSummaryResponse에 대응.
export interface BuyOfferOrderbookEntryResponse {
  buyOfferId: number;
  price: number;
  grade: ListingGrade | null;
}

// POST/PUT /api/listings 응답 — com.pokade.domain.listing.dto.ListingResponse 미러링.
export interface ListingResponse {
  id: number;
  cardId: number;
  sellerId: number;
  variantId: number | null;
  price: number;
  grade: ListingGrade | null;
  status: ListingStatus;
  settlementBankName: string | null;
  settlementAccountNumber: string | null;
  settlementAccountHolder: string | null;
  returnRecipientName: string | null;
  returnRecipientPhone: string | null;
  returnAddress: string | null;
  createdAt: string;
}

// POST /api/buy-offers/ready 요청 바디 — com.pokade.domain.price.dto.BuyOfferReadyRequest 미러링.
// 구매입찰은 등록과 동시에 토스 에스크로 결제를 진행하므로, 등록 정보와 받는사람 정보를 한 번에 보낸다.
export interface BuyOfferReadyRequest {
  cardId: number;
  variantId?: number;
  price: number;
  grade?: ListingGrade;
  // 입찰가+배송비 중 결제 전에 미리 차감할 포인트 액수 — 0이면 포인트 미사용.
  pointsToUse: number;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
}

// POST /api/buy-offers/ready 응답 — com.pokade.domain.price.dto.BuyOfferReadyResponse 미러링.
// amount는 입찰가 + 배송비에서 pointsToUse를 뺀 실제 결제(토스) 금액 — 포인트로 전액을 충당하면 0.
export interface BuyOfferReadyResponse {
  orderId: string;
  amount: number;
}

// POST /api/buy-offers/confirm-payment 응답 — com.pokade.domain.price.dto.BuyOfferResponse 미러링.
// status는 BE에서 아직 별도 enum이 아니라 문자열("ACTIVE" 고정)로 내려온다.
export interface BuyOfferResponse {
  id: number;
  cardId: number;
  buyerId: number;
  variantId: number | null;
  price: number;
  grade: ListingGrade | null;
  status: string;
  recipientName: string | null;
  recipientPhone: string | null;
  recipientAddress: string | null;
  createdAt: string;
}

// GET /api/buy-offers/me 응답 항목 — com.pokade.domain.price.dto.MyBuyOfferResponse 미러링.
// 마이페이지 "입찰" 섹션(구매입찰 탭)에서 카드 정보와 함께 보여주기 위한 별도 DTO
// (BuyOfferResponse는 카드 정보 없이 등록 직후 응답용).
export interface MyBuyOfferResponse {
  buyOfferId: number;
  cardId: number;
  cardName: string | null;
  cardImageUrl: string | null;
  variantId: number | null;
  price: number;
  grade: ListingGrade | null;
  status: string;
  createdAt: string;
}
