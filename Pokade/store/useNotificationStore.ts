import { create } from "zustand";
import { ApiError } from "@/lib/apiClient";
import { fetchNotifications, markNotificationRead } from "@/lib/watchlistApi";
import { NotificationResponse } from "@/types/notification";

const POLL_INTERVAL_MS = 30_000;

type LoadState = "loading" | "error" | "ready";

interface NotificationState {
  notifications: NotificationResponse[];
  loadState: LoadState;
  errorMessage: string;
  start: () => void;
  stop: () => void;
  retry: () => void;
  markOneRead: (n: NotificationResponse) => void;
  markAllRead: () => void;
}

// 폴링 타이머는 컴포넌트 인스턴스가 아니라 이 모듈이 유일하게 소유한다 — 여러 컴포넌트가
// start()를 동시에 불러도(Header, /notifications 페이지) 실제 fetch+interval은 하나만 존재한다.
let pollTimer: ReturnType<typeof setInterval> | null = null;

// load() 진행 중 여부 — 폴링 tick과 retry()(드롭다운 재오픈)가 동시에 fetch를 쏘는 것을 막는다.
// 응답이 늦게 오면 두 요청이 겹치고, 나중에 도착한 응답이 무조건 이기면서 화면이 순간적으로
// 오래된 상태로 되돌아갈 수 있어 — 이미 진행 중이면 새 요청 없이 그 응답을 그대로 기다린다.
let isLoading = false;

export const useNotificationStore = create<NotificationState>((set, get) => {
  // start()(폴링 등록)와 retry()(수동 1회 재조회)가 공유하는 조회 로직 — 폴링 주기/타이머
  // 관리 방식은 그대로 두고, "지금 한 번 더 불러오기"만 별도로 노출하기 위해 분리했다.
  const load = () => {
    if (isLoading) return;
    isLoading = true;
    fetchNotifications()
      .then((data) => set({ notifications: data, loadState: "ready" }))
      .catch((err) => {
        set({
          errorMessage: err instanceof ApiError ? err.message : "알림을 불러오지 못했습니다.",
          loadState: "error",
        });
      })
      .finally(() => {
        isLoading = false;
      });
  };

  return {
    notifications: [],
    loadState: "loading",
    errorMessage: "",

    // 조회+폴링의 유일한 시작점. 이미 폴링 중이면 즉시 반환(멱등) — 여러 컴포넌트가 각자
    // 마운트 시점에 호출해도 안전하다.
    start: () => {
      if (pollTimer != null) return;
      load();
      pollTimer = setInterval(load, POLL_INTERVAL_MS);
    },

    // 로그아웃 등으로 더 이상 폴링이 필요 없을 때 호출. 다음 로그인 사용자에게 이전 사용자의
    // 알림이 잠깐이라도 남아 보이지 않도록 상태도 초기값으로 되돌린다.
    stop: () => {
      if (pollTimer != null) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      set({ notifications: [], loadState: "loading", errorMessage: "" });
    },

    // 폴링 주기와 무관하게 지금 한 번 더 조회 — 에러 상태에서 드롭다운을 닫았다 다시 열 때 등
    // 수동 재시도용. 폴링 타이머는 건드리지 않는다(이미 돌고 있으면 계속 그대로 돈다).
    retry: () => load(),

    markOneRead: (n) => {
      if (n.isRead) return; // 이미 읽음 처리된 알림이면 BE가 400(NOTIFICATION_ALREADY_READ) 반환
      markNotificationRead(n.id)
        .then(() => {
          set((state) => ({
            notifications: state.notifications.map((x) =>
              x.id === n.id ? { ...x, isRead: true } : x,
            ),
          }));
        })
        .catch(() => {});
    },

    markAllRead: () => {
      const unread = get().notifications.filter((n) => !n.isRead);
      if (unread.length === 0) return;
      Promise.allSettled(unread.map((n) => markNotificationRead(n.id))).then((results) => {
        const readIds = new Set(
          unread.filter((_, i) => results[i].status === "fulfilled").map((n) => n.id),
        );
        set((state) => ({
          notifications: state.notifications.map((n) =>
            readIds.has(n.id) ? { ...n, isRead: true } : n,
          ),
        }));
      });
    },
  };
});
