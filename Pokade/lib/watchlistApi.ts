import { apiDelete, apiGet, apiPatch, apiPost, PageResponse } from "@/lib/apiClient";
import { NotificationResponse } from "@/types/notification";
import {
  WatchlistCreateRequest,
  WatchlistResponse,
  WatchlistUpdateRequest,
} from "@/types/watchlist";

// GET /api/watchlist — 로그인한 유저의 워치리스트 목록. 페이지네이션 없음(전체 배열), 인증 필요(401 가능).
export async function fetchWatchlist(): Promise<WatchlistResponse[]> {
  return apiGet<WatchlistResponse[]>("/api/watchlist");
}

// POST /api/watchlist — targetBuyPrice/targetSellPrice 둘 다 없으면 400(TARGET_PRICE_REQUIRED),
// 이미 등록된 카드면 409(DUPLICATE_WATCHLIST), 유저당 20개 초과 시 409(WATCHLIST_LIMIT_EXCEEDED).
export async function addWatchlist(request: WatchlistCreateRequest): Promise<WatchlistResponse> {
  return apiPost<WatchlistResponse>("/api/watchlist", request);
}

// PATCH /api/watchlist/{id} — targetBuyPrice/targetSellPrice 둘 다 없으면 400(TARGET_PRICE_REQUIRED),
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
