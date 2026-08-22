"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import CardImage from "@/components/CardImage";
import Pagination from "@/components/Pagination";
import IconTooltip from "@/components/IconTooltip";
import Toast from "@/components/Toast";
import { useMinuteTick } from "@/hooks/useMinuteTick";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useToast } from "@/hooks/useToast";
import { selectUnreadCount, useNotificationStore } from "@/store/useNotificationStore";
import { ApiError, PageResponse } from "@/lib/apiClient";
import { deleteNotification, fetchNotifications, markNotificationRead } from "@/lib/watchlistApi";
import {
  notifStyle,
  formatNotifTime,
  notificationHref,
  MARK_ALL_READ_BUTTON_CLASS,
} from "@/lib/notificationDisplay";
import { NotificationResponse } from "@/types/notification";

// BE #162 페이지네이션 기본값(size=20)과 맞춘다 — app/mypage/MyTradesSection.tsx와 동일하게
// 서버가 잘라준 Page를 그대로 신뢰하고, 클라이언트에서 다시 자르지 않는다.
const PAGE_SIZE = 20;

// 삭제를 눌러도 이만큼은 서버에 반영하지 않고 되돌릴 기회를 준다(#238).
// 이 화면의 다른 토스트보다 길게 잡았다 — 단순 알림(2.5초)이나 링크 토스트(4초)와 달리
// "눈치채고 → 마우스를 옮겨 → 누르는" 시간이 필요하고, 반대로 더 길면 삭제가 확정됐는지
// 아닌지 애매한 구간만 늘어난다. 토스트 표시 시간도 같은 값으로 맞춰 둘이 어긋나지 않게 한다.
const UNDO_DELETE_MS = 5000;

type LoadState = "loading" | "error" | "ready";

// 이 페이지는 useNotificationStore(헤더 알림 벨의 "최근 알림 피드")와 별개로, 자체 상태로
// 페이지 단위 조회를 한다 — 전체보기는 store가 들고 있지 않은 과거 페이지까지 봐야 하므로
// store의 배열을 그대로 슬라이싱하는 방식으로는 애초에 해결이 안 된다(MyTradesSection과 같은 이유로
// 전역 store 대신 화면 자체 상태를 쓴다). 다만 읽음 처리 시 헤더 배지/드롭다운도 함께 최신화되도록
// store의 retry()만 가져와 쓴다(마크 자체는 이 화면이 직접 호출).
export default function NotificationsPage() {
  const router = useRouter();
  const authStatus = useRequireAuth();
  // 화면을 열어둔 채 시간이 지나도 "N분 전" 표시가 굳지 않도록 1분마다 리렌더한다(#238).
  useMinuteTick();
  const startFeed = useNotificationStore((s) => s.start);
  const retryFeed = useNotificationStore((s) => s.retry);
  // "모두 읽음 처리" 노출 기준(#238) — 예전에는 "지금 보고 있는 페이지"의 안읽음으로 판단해서,
  // 1페이지에 안읽음이 7건 있어도 2페이지로 넘어가면 버튼이 사라졌다(전체에는 남아 있는데도).
  // 헤더 벨 배지와 같은 값을 쓰면 페이지를 넘겨도 기준이 흔들리지 않고, 두 화면이 같은 순간에
  // 같은 판단을 한다. store 피드(최신 20건) 범위라는 한계는 벨 배지와 동일하게 공유한다.
  const feedUnreadCount = useNotificationStore(selectUnreadCount);

  const [page, setPage] = useState(0); // BE와 동일하게 0-based로 들고 다닌다.
  // app/mypage/MyTradesSection.tsx와 동일한 패턴 — "결과"를 요청 키(requestKey)와 한 덩어리로
  // 저장하고, effect/load()는 fetch를 시작하는 것까지만 동기로 하고 결과 반영(setResult)은 항상
  // .then()/.catch() 안에서만 한다. 이러면 effect 본문에 동기 setState 호출이 없어져
  // react-hooks/set-state-in-effect 위반이 사라진다 — "로딩 중"은 별도 플래그가 아니라
  // "지금 페이지에 대한 결과가 아직 없다"는 것으로 파생 계산한다.
  const [result, setResult] = useState<{
    key: string;
    data: PageResponse<NotificationResponse> | null;
    errorMessage: string;
  } | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  // 삭제를 눌렀지만 아직 서버에 반영하지 않은 항목들 — 목록에서는 즉시 감추되(낙관적) 실제
  // DELETE는 타이머가 끝난 뒤에 보낸다(#238).
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<number>>(() => new Set());
  // 타이머 핸들은 state가 아니라 ref에 둔다 — 렌더에 쓰이지 않고, 언마운트 cleanup이 "가장 마지막
  // 값"을 봐야 하기 때문이다(state를 클로저로 잡으면 cleanup이 낡은 집합을 본다).
  const pendingTimersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  // 지금 화면에 떠 있는 토스트가 어느 항목의 것인지 — 확정 시 그 토스트만 걷어내기 위해 필요.
  const toastOwnerIdRef = useRef<number | null>(null);
  const { toast, showToast, hideToast, pauseToast, resumeToast } = useToast();

  // Header가 이미 폴링/SSE를 시작했을 것이므로 대부분 no-op이지만, 직접 진입 등 마운트 순서를
  // 보장할 수 없는 경우를 대비한 방어 호출 — start()는 멱등이라 중복 호출해도 안전하다.
  // 이 페이지는 소비만 하고 stop()은 호출하지 않는다(생명주기는 Header 전담).
  useEffect(() => {
    if (authStatus === "authenticated") startFeed();
  }, [authStatus, startFeed]);

  const requestKey = String(page);

  const load = useCallback(() => {
    if (authStatus !== "authenticated") return;
    const key = requestKey;
    fetchNotifications({ page, size: PAGE_SIZE })
      .then((res) => {
        // 삭제(개별/전체보기 마지막 항목) 또는 BE 배치가 알림을 지워 이 페이지가 비게 된 경우 —
        // 프론트에서 totalPages를 직접 추측하지 않고, 서버가 다시 알려주는 대로 이전 페이지로
        // 물러난다. 0페이지가 비면 그냥 "새 알림이 없습니다" 빈 상태로 둔다.
        if (res.content.length === 0 && page > 0) {
          setPage((p) => p - 1);
          return;
        }
        setResult({ key, data: res, errorMessage: "" });
      })
      .catch((err) => {
        setResult({
          key,
          data: null,
          errorMessage: err instanceof ApiError ? err.message : "알림을 불러오지 못했습니다.",
        });
      });
  }, [authStatus, page, requestKey]);

  useEffect(() => {
    load();
  }, [load]);

  // 화면을 벗어나는 순간 대기 중인 삭제를 즉시 확정한다(#238). 이게 없으면 사용자가 삭제를
  // 누르고 5초 안에 다른 페이지로 이동했을 때 타이머만 사라져 삭제가 조용히 취소된다 —
  // 되돌리기를 누른 적도 없는데 알림이 되살아나므로 버그로 읽힌다.
  // 여기서는 API만 쏘고 state는 건드리지 않는다(언마운트된 컴포넌트라 의미가 없다).
  // 한계: 탭을 닫거나 새로고침하면 이 cleanup이 돌기 전에 문서가 사라져 요청이 전송되지 않을
  // 수 있다. 그 경우 알림이 남는 쪽으로 실패하므로(삭제가 안 될 뿐 데이터가 사라지진 않는다)
  // 감수한다 — 인증 헤더가 필요해 sendBeacon으로는 대체할 수 없다.
  useEffect(() => {
    const timers = pendingTimersRef.current;
    return () => {
      timers.forEach((timer, id) => {
        clearTimeout(timer);
        deleteNotification(id).catch(() => {});
      });
      timers.clear();
    };
  }, []);

  // 지금 페이지(requestKey)에 대한 결과가 아니면(요청 중이거나 막 페이지가 바뀐 직후) 로딩으로 본다.
  const current = result?.key === requestKey ? result : null;
  const data = current?.data ?? null;
  const loadState: LoadState = current === null ? "loading" : data ? "ready" : "error";
  const errorMessage = current?.errorMessage ?? "";

  // 서버 응답에는 아직 남아 있지만 삭제 대기 중인 항목은 걸러낸다(#238) — 이 필터가 없으면
  // 삭제 직후의 load()(다른 항목 읽음 처리 등으로도 돈다)가 방금 감춘 행을 도로 불러온다.
  const notifications = (data?.content ?? []).filter((n) => !pendingDeleteIds.has(n.id));

  // 읽음 처리 후에는 항상 "이 페이지를 다시 불러오기 + 헤더 피드도 갱신"으로 정확성을 보장한다
  // (낙관적으로 로컬 배열만 patch하지 않는 이유: 이 화면의 data와 헤더 store의 notifications가
  // 서로 다른 fetch 결과라 낙관적 갱신을 두 군데 다 손으로 맞추면 어긋나기 쉽다).
  const markOneRead = (n: NotificationResponse) => {
    if (n.isRead) return;
    markNotificationRead(n.id)
      .then(() => {
        load();
        retryFeed();
      })
      .catch(() => {});
  };

  // 목적지 규칙은 헤더 드롭다운(components/Header.tsx)과 공유한다(lib/notificationDisplay의
  // notificationHref) — 읽음 여부와 무관하게 항상 이동한다(이미 읽은 알림이라도 다시 들어갈 수
  // 있어야 자연스럽다). 갈 곳이 없는 알림(href가 null)은 읽음 처리만 하고 제자리에 둔다.
  const handleNotificationClick = (n: NotificationResponse) => {
    markOneRead(n);
    const href = notificationHref(n);
    if (href != null) router.push(href);
  };

  // 삭제는 확인창 없이 즉시 반응하되, 실제 DELETE는 UNDO_DELETE_MS만큼 미뤄 그 사이 되돌릴 수
  // 있게 한다(#238). 확인창 대신 이 방식을 고른 이유: 알림 삭제는 저위험·고빈도 액션이라 매번
  // 모달을 띄우면 성가시고, 되돌리기는 실수한 경우만 정확히 구제한다.
  // BE DELETE가 하드 삭제라(deleteByIdAndUserId) 지운 뒤에 복구할 방법이 없다는 점도 이 방식을
  // 택한 이유다 — 되돌리기는 "아직 안 지웠다"로만 구현할 수 있다.
  const commitDelete = useCallback(
    (id: number) => {
      pendingTimersRef.current.delete(id);
      setPendingDeleteIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      // 확정되는 순간 이 항목의 토스트는 걷는다 — 토스트는 hover/focus 중이면 자동 소멸이
      // 멈추므로(useToast), 그대로 두면 이미 확정돼 눌러도 아무 일 없는 "실행취소" 버튼이
      // 화면에 남는다.
      if (toastOwnerIdRef.current === id) {
        toastOwnerIdRef.current = null;
        hideToast();
      }
      deleteNotification(id)
        .then(() => {
          load();
          retryFeed();
        })
        .catch(() => {
          // 실패했으면 서버엔 그대로 남아 있다 — 재조회하면 목록에 다시 나타난다.
          load();
          retryFeed();
        });
    },
    [hideToast, load, retryFeed],
  );

  const undoDelete = useCallback(
    (id: number) => {
      const timer = pendingTimersRef.current.get(id);
      if (timer == null) return; // 이미 확정됐으면 되돌릴 것이 없다
      clearTimeout(timer);
      pendingTimersRef.current.delete(id);
      toastOwnerIdRef.current = null;
      // 서버에서 지운 적이 없으므로 숨김만 풀면 원래 자리에 그대로 돌아온다.
      setPendingDeleteIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      hideToast();
    },
    [hideToast],
  );

  const handleDelete = (id: number) => {
    if (pendingTimersRef.current.has(id)) return; // 연타 방어
    setPendingDeleteIds((prev) => new Set(prev).add(id));
    pendingTimersRef.current.set(
      id,
      setTimeout(() => commitDelete(id), UNDO_DELETE_MS),
    );
    // 여러 건을 연달아 지우면 토스트는 마지막 것만 보여준다(useToast가 하나만 들고 있다).
    // 각 항목의 타이머는 서로 독립이라, 앞의 것들은 토스트 없이 제 시간에 확정된다.
    toastOwnerIdRef.current = id;
    showToast(
      {
        message: "알림을 삭제했습니다",
        action: { label: "실행취소", onClick: () => undoDelete(id) },
      },
      UNDO_DELETE_MS,
    );
  };

  // BE에 일괄 읽음 처리 엔드포인트가 없어(PATCH /{id}/read만 있음, NotificationController 확인됨)
  // "모두"의 범위를 이 화면 자체에서 만들어야 한다 — 지금 로드된 페이지만이 아니라 전체 페이지를
  // 다시 훑어 안읽은 알림을 모두 모은 뒤 각각 PATCH한다. 페이지 수만큼 + 안읽은 개수만큼 요청이
  // 나가 시간이 걸릴 수 있어 markingAll로 처리 중임을 표시하고 버튼을 잠근다.
  const markAllRead = async () => {
    if (!data || markingAll) return;
    setMarkingAll(true);
    try {
      const pageNumbers = Array.from({ length: data.totalPages }, (_, i) => i);
      const pages = await Promise.all(
        pageNumbers.map((p) =>
          p === page ? data : fetchNotifications({ page: p, size: PAGE_SIZE }),
        ),
      );
      const unreadIds = pages.flatMap((pg) => pg.content.filter((n) => !n.isRead).map((n) => n.id));
      if (unreadIds.length > 0) {
        await Promise.allSettled(unreadIds.map((id) => markNotificationRead(id)));
      }
    } finally {
      setMarkingAll(false);
      load();
      retryFeed();
    }
  };

  if (authStatus !== "authenticated") return null;

  return (
    <main className="main-content bg-neutral px-10 pb-14 pt-9">
      <div className="mx-auto max-w-[720px]">
        <Breadcrumb className="mb-3" items={[{ label: "홈", href: "/" }, { label: "알림" }]} />
        <div className="mb-[22px] flex items-end justify-between">
          <div>
            <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.6px]">알림</h1>
            <p className="mt-1.5 text-sm text-[#8A8A92]">
              관심 등록·거래 등 전체 알림을 확인하세요
            </p>
          </div>
          {/* 노출 조건에 loadState === "ready"를 함께 본다: 동작(markAllRead)은 이 페이지의 data가
              있어야 하므로, 로딩/에러 구간에서는 버튼이 보여도 눌러야 아무 일도 없는 no-op이 됐다.
              안읽음 판정은 스토어 피드(feedUnreadCount, 최신 20건)뿐 아니라 지금 페이지에 로드된
              알림(notifications)의 안읽음도 함께 본다 — feed 범위 밖(2페이지 이하 등)에만 안읽음이
              있으면 예전엔 버튼이 사라졌기 때문이다. markAllRead는 이미 전체 페이지를 훑으므로 동작 OK. */}
          {loadState === "ready" &&
            (feedUnreadCount > 0 || notifications.some((n) => !n.isRead)) && (
              <button
                type="button"
                onClick={markAllRead}
                disabled={markingAll}
                className={`${MARK_ALL_READ_BUTTON_CLASS} disabled:cursor-not-allowed disabled:bg-transparent disabled:text-[#C9C9CF] disabled:hover:bg-transparent disabled:hover:text-[#C9C9CF]`}
              >
                {markingAll ? "처리 중..." : "모두 읽음 처리"}
              </button>
            )}
        </div>

        {loadState === "loading" && (
          <div className="rounded-2xl border border-[#EDEDF0] bg-white px-6 py-14 text-center text-[13.5px] text-[#8A8A92]">
            불러오는 중...
          </div>
        )}

        {loadState === "error" && (
          <div
            role="alert"
            className="rounded-2xl border border-[#F6C6C6] bg-[#FFF1F1] px-6 py-6 text-center text-[13.5px] text-[#C21414]"
          >
            {errorMessage}
          </div>
        )}

        {loadState === "ready" && notifications.length === 0 && (
          <div className="rounded-2xl border border-[#EDEDF0] bg-white px-6 py-14 text-center text-[13.5px] text-[#8A8A92]">
            새 알림이 없습니다.
          </div>
        )}

        {loadState === "ready" && notifications.length > 0 && (
          <>
            {/* overflow-hidden을 걷어낸 이유(#238): 삭제 버튼 툴팁이 행 위쪽에 뜨는데, 컨테이너가
                잘라내면 첫 행에서는 툴팁이 통째로 안 보였다(실측: 툴팁 top이 컨테이너보다 23px
                위). 라운드 코너는 첫/마지막 행이 직접 맡아(first:/last:) 안읽음 틴트가 모서리를
                네모나게 덮는 문제도 그대로 막는다. */}
            <div className="rounded-2xl border border-[#EDEDF0] bg-white">
              {notifications.map((n, i) => {
                const style = notifStyle(n.type);
                return (
                  // 행 전체가 버튼 하나였다가, 삭제 버튼을 형제로 추가하면서 div로 바꿨다 —
                  // button 안에 button을 넣으면(중첩 인터랙티브 엘리먼트) 무효한 HTML이고
                  // 클릭 버블링으로 삭제가 읽음 처리까지 같이 발동하는 문제가 생긴다. 형제로
                  // 두면 그런 문제 없이 각자 독립적으로 클릭된다(stopPropagation 불필요).
                  <div
                    key={n.id}
                    className={`group relative flex w-full items-center gap-[13px] px-5 py-4 first:rounded-t-2xl last:rounded-b-2xl hover:bg-[#FAFAFB] ${
                      i < notifications.length - 1 ? "border-b border-[#F5F5F7]" : ""
                    } ${!n.isRead ? "bg-[#FFF1F1]" : ""}`}
                  >
                    {/* 안읽음 표시(#238) — 헤더 드롭다운(components/Header.tsx)과 같은 장치를 쓴다:
                        행 왼쪽 끝 3px primary 바 + 보조 틴트. 예전 배경 틴트(#FFF7F7)는 흰 배경과
                        1.06:1이라 사실상 안 보였고, 7px 점은 훑을 때 놓치기 쉬웠다. */}
                    {!n.isRead && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-0 left-0 w-[3px] bg-primary"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => handleNotificationClick(n)}
                      className="flex min-w-0 flex-1 items-center gap-[13px] text-left"
                    >
                      {/* cardImageUrl이 있으면(카드 관련 알림) 타입 아이콘 대신 카드 썸네일을 보여준다 —
                          cardId가 아니라 cardImageUrl로 분기해야 "카드는 있었지만 조회 실패"인
                          경우도 안전하게 기존 아이콘으로 폴백한다. 박스 크기·위치는 그대로 둬서
                          옆 삭제 버튼·클릭 영역과 겹칠 일이 없다. 썸네일이 있어도 종류는 구분할 수
                          있도록 우하단에 타입 아이콘을 작은 원형 배지로 겹쳐 그린다(overflow-hidden
                          밖에 배치해 안 잘림). */}
                      {n.cardImageUrl ? (
                        <div className="relative h-10 w-10 flex-shrink-0">
                          <div className="h-full w-full overflow-hidden rounded-[10px] bg-[#F2F2F5]">
                            {/* 실제 카드 이미지(images.scrydex.com) 여러 장을 대조해 보면 일러스트
                                프레임이 카드 세로 기준 대략 5~51% 지점에 있다 — object-top으로 카드
                                상단부터 잘라낸 뒤, 그 프레임만 꽉 채우도록 scale+origin으로 확대한다.
                                CardImage 자체(검색 결과 등 다른 화면)는 그대로 둔다. */}
                            <CardImage
                              src={n.cardImageUrl}
                              alt=""
                              rounded="rounded-[10px]"
                              className="origin-[50%_19%] scale-150 object-top"
                            />
                          </div>
                          <div
                            className="absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-white"
                            style={{ background: style.tint }}
                          >
                            {notifStyle(n.type, 11).icon}
                          </div>
                        </div>
                      ) : (
                        <div
                          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px]"
                          style={{ background: style.tint }}
                        >
                          {style.icon}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div
                          className={`text-[14px] leading-[1.4] text-ink ${!n.isRead ? "font-bold" : "font-semibold"}`}
                        >
                          {n.message}
                        </div>
                        <div className="mt-1 text-[12px] text-[#B0B0B8]">
                          {formatNotifTime(n.createdAt)}
                        </div>
                      </div>
                    </button>
                    {/* 삭제 버튼은 hover 전에도 보인다(#238). 예전에는 opacity-0 + group-hover로
                        감춰 뒀는데, 처음 보는 사용자는 삭제가 가능한지조차 알 수 없었고 hover가
                        없는 터치 환경에서는 아예 닿을 수 없었다. app/watchlist/page.tsx의 삭제
                        버튼은 원래부터 항상 보이는 방식이라, 이쪽을 그 패턴에 맞춘 셈이다.
                        색을 #C7C7CE에서 #8A8A92로 올린 이유: 아이콘은 그래픽 요소라 WCAG 기준이
                        3:1인데 #C7C7CE는 흰 배경에서 1.68:1로 한참 못 미쳤다. #8A8A92는 이 화면에
                        나오는 세 배경(흰색/hover #FAFAFB/안읽음 #FFF1F1) 모두에서 3.12:1 이상이다.
                        "은은하게"를 opacity로 표현하지 않은 것도 같은 이유 — 반투명은 배경과
                        섞여 실제 대비가 그만큼 깎인다(#8A8A92를 70%로 깔면 2.23:1로 도로 미달). */}
                    <IconTooltip label="삭제" placement="top" className="-m-3.5 ml-1 shrink-0">
                      <button
                        type="button"
                        aria-label="알림 삭제"
                        onClick={() => handleDelete(n.id)}
                        className="rounded-xl p-3.5 text-[#8A8A92] outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-secondary"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path d="M6 19a2 2 0 002 2h8a2 2 0 002-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                        </svg>
                      </button>
                    </IconTooltip>
                  </div>
                );
              })}
            </div>

            {data && (
              <Pagination
                page={data.number + 1}
                totalPages={data.totalPages}
                onPageChange={(p) => setPage(p - 1)}
              />
            )}
          </>
        )}
      </div>
      {/* 삭제 되돌리기 토스트(#238). hover/focus 중에는 자동 소멸이 멈춰(useToast) 실행취소를
          누를 시간을 뺏기지 않는다 — 대신 타이머가 끝나 삭제가 확정되면 commitDelete가 이
          토스트를 직접 걷어낸다. */}
      <Toast toast={toast} onPause={pauseToast} onResume={resumeToast} />
    </main>
  );
}
