import { CardPriceSummaryResponse } from "@/types/price";

// GET /api/watchlist 응답 — com.pokade.domain.watchlist.dto.WatchlistResponse 미러링.
// cardName은 card.getName() 원본(영문/원어)만 오고 nameKo 한글 매핑이 없어, 카드명 표시는
// 여전히 fetchCardDetail(카드 상세)의 nameKo를 써야 한다 — 그래서 이 타입엔 넣지 않는다.
export interface WatchlistResponse {
  id: number;
  cardId: number;
  variantId: number | null;
  setName: string | null;
  imageUrl: string | null;
  targetBuyPrice: number | null;
  targetSellPrice: number | null;
  isNotified: boolean;
  createdAt: string;
  currentPrice: CardPriceSummaryResponse | null;
  // 최근 7일 vs 이전 7일 S등급 평균 체결가 등락률(%). 등록 직후 응답(POST)에서는 null(카드/시세 미조회 상태),
  // 목록 조회(GET)에서는 항상 값이 오되 둘 중 한쪽 기간에 체결 데이터가 없으면 0.
  changeRate: number | null;
  targetReached: boolean;
}

// POST /api/watchlist 요청 바디 — com.pokade.domain.watchlist.dto.WatchlistCreateRequest 미러링.
// targetBuyPrice/targetSellPrice 둘 다 없으면 BE가 400(TARGET_PRICE_REQUIRED) 반환.
export interface WatchlistCreateRequest {
  cardId: number;
  variantId?: number;
  targetBuyPrice?: number;
  targetSellPrice?: number;
}
