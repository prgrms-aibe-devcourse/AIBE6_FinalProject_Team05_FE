import { useEffect, useState } from "react";
import { ApiError } from "@/lib/apiClient";
import { fetchNotifications, markNotificationRead } from "@/lib/watchlistApi";
import { NotificationResponse } from "@/types/notification";

const POLL_INTERVAL_MS = 30_000;

type LoadState = "loading" | "error" | "ready";

// 알림 드롭다운(Header)과 전체 알림 페이지(/notifications)가 공유하는 공용 훅 —
// 조회·30초 폴링·읽음 처리(개별/전체)를 한 곳에서 관리해 두 화면이 로직을 중복하지 않게 한다.
export function useNotifications(enabled: boolean) {
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const load = () => {
      fetchNotifications()
        .then((data) => {
          if (cancelled) return;
          setNotifications(data);
          setLoadState("ready");
        })
        .catch((err) => {
          if (cancelled) return;
          setErrorMessage(err instanceof ApiError ? err.message : "알림을 불러오지 못했습니다.");
          setLoadState("error");
        });
    };

    load();
    const timer = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markOneRead = (n: NotificationResponse) => {
    if (n.isRead) return; // 이미 읽음 처리된 알림이면 BE가 400(NOTIFICATION_ALREADY_READ) 반환
    markNotificationRead(n.id)
      .then(() => {
        setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      })
      .catch(() => {});
  };

  const markAllRead = () => {
    const unread = notifications.filter((n) => !n.isRead);
    if (unread.length === 0) return;
    Promise.allSettled(unread.map((n) => markNotificationRead(n.id))).then((results) => {
      const readIds = new Set(
        unread.filter((_, i) => results[i].status === "fulfilled").map((n) => n.id),
      );
      setNotifications((prev) => prev.map((n) => (readIds.has(n.id) ? { ...n, isRead: true } : n)));
    });
  };

  return { notifications, unreadCount, loadState, errorMessage, markOneRead, markAllRead };
}
