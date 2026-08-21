import { CardPriceSummaryResponse } from "@/types/price";

// GET /api/watchlist 응답 — com.pokade.domain.watchlist.dto.WatchlistResponse 미러링.
export interface WatchlistResponse {
  id: number;
  cardId: number;
  variantId: number | null;
  cardName: string | null;
  // CardNameKoResolver가 채움 — 도감번호가 없는 카드(트레이너/에너지)나 한글 매핑 자체가
  // 없으면 null(어설픈 오번역보다 안전하다는 BE 쪽 설계). 표시할 땐 cardNameKo ?? cardName.
  cardNameKo: string | null;
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

// GET /api/watchlist/counts 응답 원소 — com.pokade.domain.watchlist.dto.WatchlistCountResponse 미러링.
export interface WatchlistCountResponse {
  cardId: number;
  count: number;
}

// PATCH /api/watchlist/{id} 요청 바디 — com.pokade.domain.watchlist.dto.WatchlistUpdateRequest 미러링.
// targetBuyPrice/targetSellPrice 둘 다 없으면 BE가 400(TARGET_PRICE_REQUIRED) 반환 —
// 단 resendNotification=true면 이 검증을 건너뛴다(가격 없이 재알림 리셋만 요청 가능).
export interface WatchlistUpdateRequest {
  targetBuyPrice?: number;
  targetSellPrice?: number;
  // true면 가격 검증 없이 isNotified만 false로 리셋한다. 생략(undefined)/false는
  // "재알림 요청 없음"으로 기존 동작과 동일.
  resendNotification?: boolean;
}
