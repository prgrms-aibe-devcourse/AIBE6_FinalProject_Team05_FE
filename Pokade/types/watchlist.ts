// GET /api/watchlist 응답 — com.pokade.domain.watchlist.dto.WatchlistResponse 미러링.
// 카드명/이미지/시세 등 표시용 정보는 안 내려주므로, 화면에서 쓸 때는
// cardId(+variantId)로 카드 상세/시세를 별도 조회해서 조합해야 한다.
export interface WatchlistResponse {
  id: number;
  cardId: number;
  variantId: number | null;
  targetBuyPrice: number | null;
  targetSellPrice: number | null;
  isNotified: boolean;
  createdAt: string;
  // 최근 7일 vs 이전 7일 S등급 평균 체결가 등락률(%). 등록 직후 응답(POST)에서는 null(카드/시세 미조회 상태),
  // 목록 조회(GET)에서는 항상 값이 오되 둘 중 한쪽 기간에 체결 데이터가 없으면 0.
  changeRate: number | null;
}

// POST /api/watchlist 요청 바디 — com.pokade.domain.watchlist.dto.WatchlistCreateRequest 미러링.
// targetBuyPrice/targetSellPrice 둘 다 없으면 BE가 400(TARGET_PRICE_REQUIRED) 반환.
export interface WatchlistCreateRequest {
  cardId: number;
  variantId?: number;
  targetBuyPrice?: number;
  targetSellPrice?: number;
}
