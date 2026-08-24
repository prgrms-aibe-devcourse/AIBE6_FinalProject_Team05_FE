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
// cardId만 필수다. 목표가는 선택 입력이라 둘 다 생략해도 등록된다(BE #308) — 하트 빠른 등록이
// 그렇게 보낸다. TARGET_PRICE_REQUIRED는 수정(PATCH)에만 남은 검증이다.
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
// 안 보낸 가격 필드는 "기존 값 유지"로 해석된다. 그래서 목표가를 지우는 건 값으로는 표현할 수
// 없고(빈 값을 보낼 방법이 없다) 아래 clear* 플래그로만 가능하다.
//
// 요청이 유효하려면 가격이든 clear 플래그든 최소 하나는 있어야 한다 — 둘 다 없는 빈 요청만
// 400(TARGET_PRICE_REQUIRED)이다. 단 resendNotification=true면 이 검증을 건너뛴다(가격 없이
// 재알림 리셋만 요청 가능).
export interface WatchlistUpdateRequest {
  targetBuyPrice?: number;
  targetSellPrice?: number;
  // 해당 목표가를 null로 되돌린다. 같은 칸의 가격과 동시에 보내면 BE가 INVALID_INPUT으로
  // 거절하므로("얼마로 바꿔라"와 "지워라"가 모순), 지울 칸은 값을 빼고 이 플래그만 보낸다.
  // 둘 다 지우는 것도 허용 — 목표가 미설정 상태로 되돌아간다.
  clearTargetBuyPrice?: boolean;
  clearTargetSellPrice?: boolean;
  // true면 가격 검증 없이 isNotified만 false로 리셋한다. 생략(undefined)/false는
  // "재알림 요청 없음"으로 기존 동작과 동일.
  resendNotification?: boolean;
}
