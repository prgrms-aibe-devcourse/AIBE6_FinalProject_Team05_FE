"use client";

import { useEffect, useState } from "react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useNotificationStore } from "@/store/useNotificationStore";
import { notifStyle, formatNotifTime } from "@/lib/notificationDisplay";

// 한 페이지에 보여줄 알림 수 — 배치로 계속 쌓이는 구조라 전체 목록이 무한정 길어지는 것을 막는다.
// BE(GET /api/notifications)가 페이지 파라미터 없이 항상 전체 목록을 내려주므로, 지금은 이미 받아온
// 배열을 화면에서만 나눠 보여주는 클라이언트 사이드 페이지네이션이다 — payload 자체가 커지는 문제는
// 이걸로 해결되지 않는다(#162, BE 페이지네이션은 별도 작업으로 분리).
const PAGE_SIZE = 10;

// app/search/SearchResultsView.tsx의 getPaginationRange와 동일한 로직 — 이번 작업 범위상
// SearchResultsView.tsx 리팩터 없이 이 화면에 그대로 복사해 둔다.
type PaginationItem = number | "ellipsis";

function getPaginationRange(current: number, total: number): PaginationItem[] {
  const siblingCount = 1;
  const totalVisible = siblingCount * 2 + 5;

  if (totalVisible >= total) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const leftSibling = Math.max(current - siblingCount, 1);
  const rightSibling = Math.min(current + siblingCount, total);
  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < total - 1;

  if (!showLeftEllipsis && showRightEllipsis) {
    const leftItemCount = 3 + siblingCount * 2;
    const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);
    return [...leftRange, "ellipsis", total];
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    const rightItemCount = 3 + siblingCount * 2;
    const rightRange = Array.from(
      { length: rightItemCount },
      (_, i) => total - rightItemCount + i + 1,
    );
    return [1, "ellipsis", ...rightRange];
  }

  const middleRange = Array.from(
    { length: rightSibling - leftSibling + 1 },
    (_, i) => leftSibling + i,
  );
  return [1, "ellipsis", ...middleRange, "ellipsis", total];
}

export default function NotificationsPage() {
  const authStatus = useRequireAuth();
  const notifications = useNotificationStore((s) => s.notifications);
  const loadState = useNotificationStore((s) => s.loadState);
  const errorMessage = useNotificationStore((s) => s.errorMessage);
  const start = useNotificationStore((s) => s.start);
  const markOneRead = useNotificationStore((s) => s.markOneRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const [page, setPage] = useState(1);

  // Header가 이미 폴링을 시작했을 것이므로 대부분 no-op이지만, 직접 진입 등 마운트 순서를
  // 보장할 수 없는 경우를 대비한 방어 호출 — start()는 멱등이라 중복 호출해도 안전하다.
  // 이 페이지는 소비만 하고 stop()은 호출하지 않는다(생명주기는 Header 전담).
  useEffect(() => {
    if (authStatus === "authenticated") start();
  }, [authStatus, start]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const totalPages = Math.max(1, Math.ceil(notifications.length / PAGE_SIZE));

  // 알림이 삭제(개별 삭제는 아직 없지만 목록이 줄어드는 경우 전반에 대비)되어 현재 페이지가
  // 더는 존재하지 않게 되면 마지막 유효 페이지로 되돌린다. 새 알림이 도착해 총 페이지 수가
  // "늘어나는" 경우에는 건드리지 않아 사용자가 보던 페이지가 임의로 바뀌지 않게 한다.
  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const pageItems = notifications.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
              className="text-xs font-bold text-secondary hover:text-secondary-dark"
            >
              모두 읽음 처리
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
              {pageItems.map((n, i) => {
                const style = notifStyle(n.type);
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => markOneRead(n)}
                    className={`flex w-full items-center gap-[13px] px-5 py-4 text-left hover:bg-[#FAFAFB] ${
                      i < pageItems.length - 1 ? "border-b border-[#F5F5F7]" : ""
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

            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  aria-label="이전 페이지"
                  className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-[#DDDDE3] bg-white text-[13px] font-bold text-[#4B4B52] enabled:hover:border-primary enabled:hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  &lt;
                </button>
                {getPaginationRange(page, totalPages).map((p, i) =>
                  p === "ellipsis" ? (
                    <span
                      key={`ellipsis-${i}`}
                      className="flex h-9 w-9 items-center justify-center text-[13px] text-[#9A9AA2]"
                    >
                      ...
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      aria-current={p === page ? "page" : undefined}
                      className={`h-9 w-9 rounded-[9px] text-[13px] font-bold ${
                        p === page
                          ? "bg-primary text-white"
                          : "border border-[#DDDDE3] bg-white text-[#4B4B52] hover:border-primary hover:text-primary"
                      }`}
                    >
                      {p}
                    </button>
                  ),
                )}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  aria-label="다음 페이지"
                  className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-[#DDDDE3] bg-white text-[13px] font-bold text-[#4B4B52] enabled:hover:border-primary enabled:hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  &gt;
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
