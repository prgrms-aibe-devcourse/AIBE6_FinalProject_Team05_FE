"use client";

import { useEffect } from "react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useNotificationStore } from "@/store/useNotificationStore";
import { notifStyle, formatNotifTime } from "@/lib/notificationDisplay";

export default function NotificationsPage() {
  const authStatus = useRequireAuth();
  const notifications = useNotificationStore((s) => s.notifications);
  const loadState = useNotificationStore((s) => s.loadState);
  const errorMessage = useNotificationStore((s) => s.errorMessage);
  const start = useNotificationStore((s) => s.start);
  const markOneRead = useNotificationStore((s) => s.markOneRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);

  // Header가 이미 폴링을 시작했을 것이므로 대부분 no-op이지만, 직접 진입 등 마운트 순서를
  // 보장할 수 없는 경우를 대비한 방어 호출 — start()는 멱등이라 중복 호출해도 안전하다.
  // 이 페이지는 소비만 하고 stop()은 호출하지 않는다(생명주기는 Header 전담).
  useEffect(() => {
    if (authStatus === "authenticated") start();
  }, [authStatus, start]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

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
        )}
      </div>
    </main>
  );
}
