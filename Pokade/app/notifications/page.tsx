"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Pagination from "@/components/Pagination";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useNotificationStore } from "@/store/useNotificationStore";
import { ApiError, PageResponse } from "@/lib/apiClient";
import { deleteNotification, fetchNotifications, markNotificationRead } from "@/lib/watchlistApi";
import { notifStyle, formatNotifTime } from "@/lib/notificationDisplay";
import { NotificationResponse } from "@/types/notification";

// BE #162 페이지네이션 기본값(size=20)과 맞춘다 — app/mypage/MyTradesSection.tsx와 동일하게
// 서버가 잘라준 Page를 그대로 신뢰하고, 클라이언트에서 다시 자르지 않는다.
const PAGE_SIZE = 20;

type LoadState = "loading" | "error" | "ready";

// 이 페이지는 useNotificationStore(헤더 알림 벨의 "최근 알림 피드")와 별개로, 자체 상태로
// 페이지 단위 조회를 한다 — 전체보기는 store가 들고 있지 않은 과거 페이지까지 봐야 하므로
// store의 배열을 그대로 슬라이싱하는 방식으로는 애초에 해결이 안 된다(MyTradesSection과 같은 이유로
// 전역 store 대신 화면 자체 상태를 쓴다). 다만 읽음 처리 시 헤더 배지/드롭다운도 함께 최신화되도록
// store의 retry()만 가져와 쓴다(마크 자체는 이 화면이 직접 호출).
export default function NotificationsPage() {
  const router = useRouter();
  const authStatus = useRequireAuth();
  const startFeed = useNotificationStore((s) => s.start);
  const retryFeed = useNotificationStore((s) => s.retry);

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

  // 지금 페이지(requestKey)에 대한 결과가 아니면(요청 중이거나 막 페이지가 바뀐 직후) 로딩으로 본다.
  const current = result?.key === requestKey ? result : null;
  const data = current?.data ?? null;
  const loadState: LoadState = current === null ? "loading" : data ? "ready" : "error";
  const errorMessage = current?.errorMessage ?? "";

  const notifications = data?.content ?? [];
  // "모두 읽음 처리" 버튼 노출 여부는 여전히 이 페이지 기준이다 — BE에 안읽음 개수만 알려주는
  // API가 없어 페이지 단위로 판단할 수밖에 없다(다른 페이지에만 안읽음이 남아있는데 지금 페이지가
  // 전부 읽음 처리된 극단적인 경우 버튼이 숨는 사각지대는 남지만, 눌렀을 때 실제로 처리되는 범위
  // 자체는 markAllRead가 이제 전체 페이지를 훑으므로 항상 맞다).
  const unreadCount = notifications.filter((n) => !n.isRead).length;

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

  // 읽음 처리 여부와 무관하게, cardId가 있는 알림은 항상 카드 상세로 이동한다 — 이미 읽은
  // 알림이라도 다시 들어갈 수 있어야 자연스럽다. cardId가 없는 알림(문의 처리 등)은 기존처럼
  // 읽음 처리만 하고 제자리에 둔다.
  const handleNotificationClick = (n: NotificationResponse) => {
    markOneRead(n);
    if (n.cardId != null) router.push(`/cards/${n.cardId}`);
  };

  // 확인창 없이 즉시 삭제(결정된 방향) — 삭제한 알림이 안읽음이었어도 신경 쓰지 않고 항상
  // load()+retryFeed()로 재조회한다(markOneRead와 같은 이유: 이 화면 상태와 헤더 store가
  // 서로 다른 fetch 결과라 낙관적으로 손으로 맞추기보다 다시 불러오는 쪽이 항상 정확하다).
  const handleDelete = (id: number) => {
    deleteNotification(id)
      .then(() => {
        load();
        retryFeed();
      })
      .catch(() => {});
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
        <div className="mb-[22px] flex items-end justify-between">
          <div>
            <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.6px]">알림</h1>
            <p className="mt-1.5 text-sm text-[#8A8A92]">
              워치리스트·거래 등 전체 알림을 확인하세요
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              disabled={markingAll}
              className="text-xs font-bold text-secondary hover:text-secondary-dark disabled:cursor-not-allowed disabled:text-[#C9C9CF] disabled:hover:text-[#C9C9CF]"
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
            <div className="overflow-hidden rounded-2xl border border-[#EDEDF0] bg-white">
              {notifications.map((n, i) => {
                const style = notifStyle(n.type);
                return (
                  // 행 전체가 버튼 하나였다가, 삭제 버튼을 형제로 추가하면서 div로 바꿨다 —
                  // button 안에 button을 넣으면(중첩 인터랙티브 엘리먼트) 무효한 HTML이고
                  // 클릭 버블링으로 삭제가 읽음 처리까지 같이 발동하는 문제가 생긴다. 형제로
                  // 두면 그런 문제 없이 각자 독립적으로 클릭된다(stopPropagation 불필요).
                  <div
                    key={n.id}
                    className={`group flex w-full items-center gap-[13px] px-5 py-4 hover:bg-[#FAFAFB] ${
                      i < notifications.length - 1 ? "border-b border-[#F5F5F7]" : ""
                    } ${!n.isRead ? "bg-[#FFF7F7]" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => handleNotificationClick(n)}
                      className="flex min-w-0 flex-1 items-center gap-[13px] text-left"
                    >
                      <span
                        className={`h-[7px] w-[7px] flex-shrink-0 rounded-full ${!n.isRead ? "bg-primary" : "bg-transparent"}`}
                      />
                      <div
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px]"
                        style={{ background: style.tint }}
                      >
                        {style.icon}
                      </div>
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
                    {/* hover-reveal 삭제 — app/search/SearchFilterSidebar.tsx의 등급 툴팁과 동일한
                        group/opacity 패턴, 아이콘·색은 app/watchlist/page.tsx 삭제 버튼과 통일.
                        group-focus-within도 같이 둬서 Tab으로 포커스했을 때도 보이게 한다(마우스
                        hover가 없는 키보드 사용자 접근성 — 모바일 터치 대응은 이번 범위 밖). */}
                    <button
                      type="button"
                      aria-label="알림 삭제"
                      onClick={() => handleDelete(n.id)}
                      className="-m-3.5 ml-1 shrink-0 p-3.5 text-[#C7C7CE] opacity-0 transition-opacity hover:text-primary group-focus-within:opacity-100 group-hover:opacity-100"
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
    </main>
  );
}
