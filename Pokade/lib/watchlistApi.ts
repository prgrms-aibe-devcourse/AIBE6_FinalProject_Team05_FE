import { apiDelete, apiGet, apiPatch, apiPost, PageResponse } from "@/lib/apiClient";
import { NotificationResponse } from "@/types/notification";
import {
  WatchlistCountResponse,
  WatchlistCreateRequest,
  WatchlistResponse,
  WatchlistUpdateRequest,
} from "@/types/watchlist";

// GET /api/watchlist — 로그인한 유저의 워치리스트 목록. 페이지네이션 없음(전체 배열), 인증 필요(401 가능).
export async function fetchWatchlist(): Promise<WatchlistResponse[]> {
  return apiGet<WatchlistResponse[]>("/api/watchlist");
}

// POST /api/watchlist — 목표가는 선택 입력이다(BE #308). targetBuyPrice/targetSellPrice가 둘 다
// 없어도 등록되고, 목표가는 이후 /watchlist에서 넣는다 — 하트 빠른 등록이 이 경로를 쓴다.
// TARGET_PRICE_REQUIRED 검증은 등록에서 빠졌고 수정(PATCH)에만 남아 있다(아래 updateWatchlist).
// 이미 등록된 카드면 409(DUPLICATE_WATCHLIST), 유저당 20개 초과 시 409(WATCHLIST_LIMIT_EXCEEDED).
export async function addWatchlist(request: WatchlistCreateRequest): Promise<WatchlistResponse> {
  return apiPost<WatchlistResponse>("/api/watchlist", request);
}

// PATCH /api/watchlist/{id} — 가격이든 clear* 플래그든 최소 하나는 있어야 한다. 아무것도 없는
// 빈 요청이면 400(TARGET_PRICE_REQUIRED), 같은 칸의 가격과 clear를 함께 보내면 400(INVALID_INPUT).
// 단 resendNotification=true면 이 검증을 건너뛰고 가격은 그대로 둔 채 isNotified만 false로 리셋한다.
// 본인 소유가 아니거나 없는 id면 404(WATCHLIST_NOT_FOUND). 응답은 WatchlistResponse.of()로 만들어져
// cardName/setName/imageUrl/currentPrice/changeRate/targetReached가 전부 null/false로 오지만
// isNotified는 실제 현재 값이 온다 — 호출부에서 통째로 덮어쓰지 말고
// targetBuyPrice/targetSellPrice/isNotified만 반영해야 한다.
export async function updateWatchlist(
  id: number,
  request: WatchlistUpdateRequest,
): Promise<WatchlistResponse> {
  return apiPatch<WatchlistResponse>(`/api/watchlist/${id}`, request);
}

// DELETE /api/watchlist/{id} — 본인 소유가 아니거나 없는 id면 404(WATCHLIST_NOT_FOUND).
export async function deleteWatchlistItem(id: number): Promise<void> {
  return apiDelete(`/api/watchlist/${id}`);
}

// BE 배치 한도(WatchlistService.MAX_COUNT_CARD_IDS)와 일치 — 초과분은 여러 번 나눠 호출한다.
const WATCHLIST_COUNTS_BATCH_SIZE = 100;

// GET /api/watchlist/counts?cardIds=1,2,3 — 카드별 관심(워치리스트) 등록 수 배치 조회.
// 인증 불필요(비로그인도 허용). 요청에 넣은 cardId는 등록 수가 0이어도 응답에 포함되므로
// Map으로 변환해서 반환한다(호출부는 없는 카드는 그냥 undefined로 처리하면 됨).
export async function fetchWatchlistCounts(cardIds: number[]): Promise<Map<number, number>> {
  const distinctIds = Array.from(new Set(cardIds));
  if (distinctIds.length === 0) return new Map();

  const chunks: number[][] = [];
  for (let i = 0; i < distinctIds.length; i += WATCHLIST_COUNTS_BATCH_SIZE) {
    chunks.push(distinctIds.slice(i, i + WATCHLIST_COUNTS_BATCH_SIZE));
  }

  const results = await Promise.all(
    chunks.map((chunk) =>
      apiGet<WatchlistCountResponse[]>(`/api/watchlist/counts?cardIds=${chunk.join(",")}`),
    ),
  );

  return new Map(results.flat().map((r) => [r.cardId, r.count]));
}

// GET /api/notifications — 로그인한 유저의 알림 목록. #162부터 Pageable을 받아 Page<NotificationResponse>를
// 돌려준다(파라미터 없으면 BE @PageableDefault(size=20, sort=createdAt desc) 적용). 인증 필요(401 가능).
// 하위 호환: 배포 과도기 등으로 BE가 아직 예전 버전(배열 그대로)을 내려주는 경우에도 죽지 않도록,
// 배열이면 "전체가 한 페이지"인 PageResponse로 감싸 반환한다 — 호출부는 항상 PageResponse만 다루면 된다.
export async function fetchNotifications(
  params: { page?: number; size?: number } = {},
): Promise<PageResponse<NotificationResponse>> {
  const query = new URLSearchParams();
  if (params.page != null) query.set("page", String(params.page));
  if (params.size != null) query.set("size", String(params.size));
  const qs = query.toString();
  const data = await apiGet<PageResponse<NotificationResponse> | NotificationResponse[]>(
    `/api/notifications${qs ? `?${qs}` : ""}`,
  );
  if (Array.isArray(data)) {
    return {
      content: data,
      totalElements: data.length,
      totalPages: 1,
      number: 0,
      size: data.length,
      first: true,
      last: true,
    };
  }
  return data;
}

// PATCH /api/notifications/{id}/read — 이미 읽음 처리된 알림이면 400(NOTIFICATION_ALREADY_READ).
export async function markNotificationRead(id: number): Promise<void> {
  return apiPatch<void>(`/api/notifications/${id}/read`);
}

// DELETE /api/notifications/{id} — 본인 소유가 아니거나 없는 id면 404(NOTIFICATION_NOT_FOUND),
// 소유 여부를 구분해 노출하지 않는다(BE가 조건부 원자적 DELETE로 처리).
export async function deleteNotification(id: number): Promise<void> {
  return apiDelete(`/api/notifications/${id}`);
}
