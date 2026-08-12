import { apiDelete, apiGet, apiPatch } from "@/lib/apiClient";
import { NotificationResponse } from "@/types/notification";
import { WatchlistResponse } from "@/types/watchlist";

// GET /api/watchlist — 로그인한 유저의 워치리스트 목록. 페이지네이션 없음(전체 배열), 인증 필요(401 가능).
export async function fetchWatchlist(): Promise<WatchlistResponse[]> {
  return apiGet<WatchlistResponse[]>("/api/watchlist");
}

// DELETE /api/watchlist/{id} — 본인 소유가 아니거나 없는 id면 404(WATCHLIST_NOT_FOUND).
export async function deleteWatchlistItem(id: number): Promise<void> {
  return apiDelete(`/api/watchlist/${id}`);
}

// GET /api/notifications — 로그인한 유저의 알림 목록. 페이지네이션 없음(전체 배열), 인증 필요(401 가능).
export async function fetchNotifications(): Promise<NotificationResponse[]> {
  return apiGet<NotificationResponse[]>("/api/notifications");
}

// PATCH /api/notifications/{id}/read — 이미 읽음 처리된 알림이면 400(NOTIFICATION_ALREADY_READ).
export async function markNotificationRead(id: number): Promise<void> {
  return apiPatch<void>(`/api/notifications/${id}/read`);
}
