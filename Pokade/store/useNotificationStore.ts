import { create } from "zustand";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { ApiError, API_BASE_URL } from "@/lib/apiClient";
import { getAccessToken } from "@/lib/authToken";
import { fetchNotifications, markNotificationRead } from "@/lib/watchlistApi";
import { NotificationResponse } from "@/types/notification";

const POLL_INTERVAL_MS = 30_000;
// 헤더 알림 벨(배지+드롭다운)이 들고 있을 알림 수 — BE #162 페이지네이션 기본값(20)과 맞춘다.
// 이 화면은 "최근 알림 피드"라 전체 목록이 필요 없고, /notifications 전체보기 페이지가 나머지를
// 페이지 단위로 따로 가져온다(app/notifications/page.tsx). 안읽음 배지·모두읽음 처리도 이 범위
// 안에서만 정확하다 — 안읽은 알림이 20개를 넘는 극단적인 경우까지는 이번 범위에서 다루지 않는다.
const FEED_SIZE = 20;
const SSE_URL = `${API_BASE_URL}/api/notifications/subscribe`;
// 이 횟수만큼 SSE 재연결을 시도하다 실패하면 폴링으로 완전히 넘어간다 — 네트워크 일시
// 오류는 몇 번 더 시도해볼 가치가 있지만, 무한 재시도는 폴링 없이 알림이 멎는 상태를 만든다.
const SSE_MAX_RETRIES = 3;
// 폴링으로 넘어간 뒤에도 이 주기로 SSE 재연결을 다시 시도한다 — 네트워크가 회복돼도
// 세션이 끝날 때까지 폴링에 갇혀 있지 않도록.
const SSE_POLL_RETRY_INTERVAL_MS = 5 * 60_000;

type LoadState = "loading" | "error" | "ready";
// SSE로 실시간 수신 중인지, 폴링으로 대체 중인지 — 전환 로직 자체(재연결 시도, 폴링 폴백)는
// 그대로 필요하지만, 이 값을 보여주던 Header 알림 벨의 점 인디케이터는 너무 작아 알아보기
// 어렵고 SSE/폴링이라는 구현 디테일이 사용자에겐 무의미해서 제거했다(#173) — 지금은 UI 소비처
// 없이 내부 전환 로직에서만 쓰인다.
type ConnectionMode = "sse" | "polling";

interface NotificationState {
  notifications: NotificationResponse[];
  loadState: LoadState;
  errorMessage: string;
  connectionMode: ConnectionMode;
  // SSE로 새 알림이 실제로 도착할 때마다 +1 되는 카운터(#235). 헤더 벨이 이 값을 key로 써서
  // 도착 순간에만 흔들림 애니메이션을 한 번 재생한다.
  //
  // "도착"만 세는 게 핵심이다 — 최초 조회/폴링(load())은 목록을 통째로 교체하는 별개 경로라
  // 여기를 건드리지 않는다. 그래서 안 읽은 알림을 잔뜩 둔 채 페이지를 열어도 벨이 흔들리지
  // 않고, SSE 재연결(onopen)이나 폴링 전환도 onmessage를 거치지 않아 오발동하지 않는다.
  // 0은 "아직 도착한 적 없음"(=초기 렌더)이라 소비처가 이 값으로 첫 렌더를 걸러낸다.
  arrivalSeq: number;
  start: () => void;
  stop: () => void;
  retry: () => void;
  markOneRead: (n: NotificationResponse) => void;
  markAllRead: () => void;
}

// 안 읽은 알림 개수 — 헤더 벨 배지/드롭다운과 전체 알림 페이지(/notifications)가 같은 값을
// 보도록 한 곳에 둔다(#238). 예전에는 두 화면이 각자 다른 기준을 썼다: 헤더는 이 피드 기준,
// 전체 목록 페이지는 "지금 보고 있는 페이지" 기준이라 2페이지로 넘어가면 안읽음이 남아 있어도
// "모두 읽음 처리" 버튼이 사라졌다.
//
// 한계는 그대로 남는다 — 이 값은 store가 들고 있는 최신 FEED_SIZE(20)건 안에서만 정확하다.
// BE에 안읽음 개수만 알려주는 API가 없어 전체 집계를 알 방법이 없다(NotificationController에
// GET /api/notifications와 PATCH /{id}/read만 있음). 다만 화면마다 다른 기준으로 버튼이
// 나타났다 사라지는 것보다는, 세 곳이 같은 한계를 공유하는 편이 예측 가능하다.
export const selectUnreadCount = (s: NotificationState) =>
  s.notifications.filter((n) => !n.isRead).length;

// 폴링 타이머는 컴포넌트 인스턴스가 아니라 이 모듈이 유일하게 소유한다 — 여러 컴포넌트가
// start()를 동시에 불러도(Header, /notifications 페이지) 실제 fetch+interval은 하나만 존재한다.
let pollTimer: ReturnType<typeof setInterval> | null = null;

// SSE 연결도 마찬가지로 이 모듈이 유일하게 소유 — start() 중복 호출에도 연결은 하나만 유지.
let sseAbortController: AbortController | null = null;
let sseRetryCount = 0;

// 폴링 중 SSE 재도전 타이머 — 이것도 이 모듈이 유일하게 소유. stopPolling()과 생명주기를
// 함께해서(둘 다 SSE가 다시 붙거나 stop()이 호출되면 정리) 별도로 챙기지 않아도 되게 한다.
let sseReconnectTimer: ReturnType<typeof setInterval> | null = null;

// "세션 세대" 카운터 — stop()이 호출될 때마다 증가해, 그 이전 세션(폴링 응답이든 SSE
// 콜백이든)이 새 세션의 상태를 건드리지 못하게 막는다(로그아웃 후 뒤늦게 도착한 응답/이벤트가
// 다음 로그인 사용자의 상태를 덮어쓰는 것 방지). SSE는 연결이 하나뿐이라 실제 생명주기 관리는
// AbortController가 담당하고, generation은 "이 콜백이 지금 세션 것이 맞는지" 확인하는 용도로만 쓴다.
let generation = 0;

// 현재 진행 중인 폴링 요청이 어느 세대 것인지 — null이면 진행 중인 요청 없음.
// "같은 세대 안에서 폴링 tick과 retry()가 동시에 fetch를 쏘는 것"을 막는 가드와
// "stop() 이후 낡은 응답이 상태를 덮어쓰는 것"을 막는 가드를 하나로 합친 것 — 단순 isLoading
// 불리언이었다면, stop() 직후 재로그인한 새 세대의 fetch가 "아직 안 끝난 이전 세대의 요청"
// 때문에 스킵되거나, 반대로 이전 세대 응답이 finally에서 새 세대의 진행 상태를 조기에
// 지워버리는 문제가 생긴다 — 세대 번호로 "내 요청이 맞는지"를 확인해야 두 문제가 해결된다.
let inFlightGeneration: number | null = null;

// SSE가 401을 받았을 때 fetchEventSource의 무한 재시도를 멈추기 위한 전용 에러 —
// onopen에서 던지면 onerror로 전달되고, onerror가 다시 던지면 재시도 없이 완전히 중단된다.
class SseAuthError extends Error {}

export const useNotificationStore = create<NotificationState>((set, get) => {
  // start()(폴링 등록)와 retry()(수동 1회 재조회)가 공유하는 조회 로직 — 폴링 주기/타이머
  // 관리 방식은 그대로 두고, "지금 한 번 더 불러오기"만 별도로 노출하기 위해 분리했다.
  const load = () => {
    if (inFlightGeneration === generation) return; // 같은 세대에서 이미 진행 중이면 스킵
    const myGeneration = generation;
    inFlightGeneration = myGeneration;
    fetchNotifications({ size: FEED_SIZE })
      .then((data) => {
        if (myGeneration !== generation) return; // 그 사이 stop()으로 세대가 바뀜 — 낡은 응답 무시
        set({ notifications: data.content, loadState: "ready" });
      })
      .catch((err) => {
        if (myGeneration !== generation) return;
        set({
          errorMessage: err instanceof ApiError ? err.message : "알림을 불러오지 못했습니다.",
          loadState: "error",
        });
      })
      .finally(() => {
        // 내 요청이 여전히 "진행 중"으로 기록된 그 요청일 때만 해제 — 그 사이 stop()→start()로
        // 새 세대의 요청이 이미 inFlightGeneration을 차지했다면 그건 건드리지 않는다.
        if (inFlightGeneration === myGeneration) inFlightGeneration = null;
      });
  };

  // SSE와 폴링이 동시에 돌지 않도록 폴링 쪽 시작/정지를 별도 함수로 분리 — SSE 연결 성공 시
  // stopPolling(), SSE가 완전히 포기했을 때 startPolling()을 각각 명시적으로 호출한다.
  const startPolling = (myGeneration: number) => {
    if (pollTimer != null) return;
    set({ connectionMode: "polling" });
    load();
    pollTimer = setInterval(load, POLL_INTERVAL_MS);

    // 폴링에 들어간 시점(=SSE를 포기한 시점)에만 예약 — 이미 폴링 중이면 위에서 이미 return돼
    // 중복 예약되지 않는다.
    sseReconnectTimer = setInterval(() => {
      if (myGeneration !== generation) return; // stop() 이후 낡은 타이머 — stopPolling에서 이미 정리되지만 방어적으로 한 번 더 확인
      sseRetryCount = 0; // 새 재도전이니 이전 실패 횟수를 리셋해 다시 3회 백오프 기회를 준다
      connectSse(myGeneration);
    }, SSE_POLL_RETRY_INTERVAL_MS);
  };

  const stopPolling = () => {
    if (pollTimer != null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (sseReconnectTimer != null) {
      clearInterval(sseReconnectTimer);
      sseReconnectTimer = null;
    }
  };

  const connectSse = (myGeneration: number) => {
    const controller = new AbortController();
    sseAbortController = controller;
    const token = getAccessToken();

    fetchEventSource(SSE_URL, {
      signal: controller.signal,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      openWhenHidden: true, // 백그라운드 탭에서도 연결 유지 — 탭 전환마다 재연결하지 않도록

      async onopen(response) {
        if (myGeneration !== generation) return;
        if (response.ok) {
          sseRetryCount = 0;
          set({ connectionMode: "sse" });
          stopPolling(); // SSE로 연결됐으면 폴링은 필요 없다
          return;
        }
        if (response.status === 401) throw new SseAuthError("SSE unauthorized");
        throw new Error(`SSE open failed: ${response.status}`);
      },

      onmessage(ev) {
        if (myGeneration !== generation) return;
        if (ev.event !== "notification") return; // connect 이벤트/하트비트는 무시

        // 파싱/필드 검증 실패가 fetchEventSource로 전파되면 정상 연결인데도 에러로 취급돼
        // 불필요한 재연결/폴백을 유발한다 — 여기서 끝까지 흡수하고 해당 이벤트만 무시한다.
        let payload: NotificationResponse;
        try {
          payload = JSON.parse(ev.data) as NotificationResponse;
        } catch (err) {
          console.error("[SSE] 알림 이벤트 파싱 실패:", err, ev.data);
          return;
        }
        if (typeof payload?.id !== "number") {
          console.error("[SSE] 알림 이벤트에 유효한 id가 없음:", ev.data);
          return;
        }

        set((state) => {
          if (state.notifications.some((n) => n.id === payload.id)) return state; // 중복 수신 방지
          // 중복 판정을 통과한, 진짜 새로 도착한 알림일 때만 arrivalSeq를 올린다 — 같은 알림을
          // 두 번 받아도 벨이 두 번 흔들리지 않는다.
          return {
            notifications: [payload, ...state.notifications],
            loadState: "ready",
            arrivalSeq: state.arrivalSeq + 1,
          };
        });
      },

      onclose() {
        if (myGeneration !== generation) return;
        // 서버가 30분 연결 유지 한도로 정상 종료한 경우 — 에러가 아니라 곧바로 재연결한다.
        connectSse(myGeneration);
      },

      onerror(err) {
        if (myGeneration !== generation) throw err; // 이미 종료된 세션 — 재시도하지 않음

        if (err instanceof SseAuthError) {
          startPolling(myGeneration); // 인증 실패는 재시도해도 소용없으니 즉시 폴링으로 전환
          throw err; // 재시도 중단
        }

        sseRetryCount++;
        if (sseRetryCount > SSE_MAX_RETRIES) {
          startPolling(myGeneration); // 몇 차례 재시도해도 안 되면 폴링으로 넘어가고 SSE는 포기
          throw err; // 재시도 중단
        }
        return sseRetryCount * 1000; // 1초, 2초, 3초 순으로 늘려가며 재시도
      },
    }).catch(() => {
      // onerror에서 다시 throw한 에러가 여기로 떨어진다 — 이미 폴링으로 전환 처리했으므로 무시.
    });
  };

  return {
    notifications: [],
    loadState: "loading",
    errorMessage: "",
    // onopen에서 SSE 확정 전까지는 성급하게 "실시간 연결됨"으로 보여주지 않도록 보수적으로 시작.
    connectionMode: "polling",
    arrivalSeq: 0,

    // 조회+구독의 유일한 시작점. 이미 시작돼 있으면 즉시 반환(멱등) — 여러 컴포넌트가 각자
    // 마운트 시점에 호출해도 안전하다. 초기 목록을 한 번 불러온 뒤 SSE 연결을 시도하고,
    // SSE가 실패하면 그 시점에 폴링으로 전환한다(onopen/onerror 참고).
    start: () => {
      if (pollTimer != null || sseAbortController != null) return;
      const myGeneration = generation;
      load();
      connectSse(myGeneration);
    },

    // 로그아웃 등으로 더 이상 구독이 필요 없을 때 호출. 다음 로그인 사용자에게 이전 사용자의
    // 알림이 잠깐이라도 남아 보이지 않도록 상태도 초기값으로 되돌린다.
    stop: () => {
      generation++; // 이 시점 이전 세션의 응답/이벤트를 전부 무효화
      sseAbortController?.abort();
      sseAbortController = null;
      sseRetryCount = 0;
      stopPolling();
      // arrivalSeq도 0으로 되돌린다 — 안 그러면 다음 로그인 사용자의 첫 렌더에서 값이 이미
      // 0보다 커서, 도착한 알림이 없는데도 벨이 흔들린다.
      set({
        notifications: [],
        loadState: "loading",
        errorMessage: "",
        connectionMode: "polling",
        arrivalSeq: 0,
      });
    },

    // 폴링 주기와 무관하게 지금 한 번 더 조회 — 에러 상태에서 드롭다운을 닫았다 다시 열 때 등
    // 수동 재시도용. SSE/폴링 타이머는 건드리지 않는다(이미 돌고 있으면 계속 그대로 돈다).
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
