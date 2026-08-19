"use client";

import { useCallback, useEffect, useState } from "react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useNotificationStore } from "@/store/useNotificationStore";
import { ApiError, PageResponse } from "@/lib/apiClient";
import { fetchNotifications, markNotificationRead } from "@/lib/watchlistApi";
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
  const authStatus = useRequireAuth();
  const startFeed = useNotificationStore((s) => s.start);
  const retryFeed = useNotificationStore((s) => s.retry);

  const [page, setPage] = useState(0); // BE와 동일하게 0-based로 들고 다닌다.
  const [data, setData] = useState<PageResponse<NotificationResponse> | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [markingAll, setMarkingAll] = useState(false);

  // Header가 이미 폴링/SSE를 시작했을 것이므로 대부분 no-op이지만, 직접 진입 등 마운트 순서를
  // 보장할 수 없는 경우를 대비한 방어 호출 — start()는 멱등이라 중복 호출해도 안전하다.
  // 이 페이지는 소비만 하고 stop()은 호출하지 않는다(생명주기는 Header 전담).
  useEffect(() => {
    if (authStatus === "authenticated") startFeed();
  }, [authStatus, startFeed]);

  const load = useCallback(() => {
    if (authStatus !== "authenticated") return;
    setLoadState("loading");
    fetchNotifications({ page, size: PAGE_SIZE })
      .then((res) => {
        setData(res);
        setLoadState("ready");
      })
      .catch((err) => {
        setErrorMessage(err instanceof ApiError ? err.message : "알림을 불러오지 못했습니다.");
        setLoadState("error");
      });
  }, [authStatus, page]);

  useEffect(() => {
    load();
  }, [load]);

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
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => markOneRead(n)}
                    className={`flex w-full items-center gap-[13px] px-5 py-4 text-left hover:bg-[#FAFAFB] ${
                      i < notifications.length - 1 ? "border-b border-[#F5F5F7]" : ""
                    } ${!n.isRead ? "bg-[#FFF7F7]" : ""}`}
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
                );
              })}
            </div>

            {data && data.totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-5 text-[13px]">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={data.first}
                  className="text-[#4B4B52] disabled:text-[#C9C9CF]"
                >
                  ‹ 이전
                </button>
                <span className="font-bold">
                  {data.number + 1} / {data.totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={data.last}
                  className="text-[#4B4B52] disabled:text-[#C9C9CF]"
                >
                  다음 ›
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
