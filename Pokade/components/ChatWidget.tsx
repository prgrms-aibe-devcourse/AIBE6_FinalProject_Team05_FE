"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useChat } from "@/hooks/useChat";
import { MAX_CHAT_MESSAGE_LENGTH } from "@/types/chat";
import RankingList from "@/components/RankingList";

// 시세 챗봇 위젯 - 모든 페이지 우하단 FAB. 클릭하면 작은 창으로 미리보기 채팅을 하고,
// "자세히 보기"를 누르면 전체 화면인 /chat 페이지로 이동한다.
// /chat 안에서는 중복이라 숨기는데, useChat()이 불필요한 API 호출(FAQ/이력)을 하지 않도록
// 경로 검사를 이 얇은 wrapper에서 먼저 하고, 본문(useChat 포함)은 /chat이 아닐 때만 마운트한다.
export default function ChatWidget() {
  const pathname = usePathname();
  if (pathname === "/chat") return null;
  return <ChatWidgetPanel />;
}

function ChatWidgetPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const {
    isLoggedIn,
    messages,
    quickQuestions,
    sending,
    error,
    rateLimited,
    send,
    goToLogin,
    loadHistory,
  } = useChat({ eagerHistory: false });
  const scrollRef = useRef<HTMLDivElement>(null);

  // 위젯은 모든 페이지에 항상 마운트돼 있으므로, 이력은 열기 전까지 미뤘다가 처음 열릴 때만 불러온다.
  useEffect(() => {
    if (open) loadHistory();
  }, [open, loadHistory]);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [open, messages, sending]);

  function handleSubmit() {
    if (sending) return;
    if (!isLoggedIn) {
      goToLogin();
      return;
    }
    send(draft, false);
    setDraft("");
  }

  // 비로그인은 미니 위젯에서 FAQ까지만 - "자세히 보기"로 /chat 전체 페이지에 자유롭게 드나드는 것도 막고 로그인으로 보낸다.
  function handleViewMore() {
    if (!isLoggedIn) {
      goToLogin();
      return;
    }
    router.push("/chat");
  }

  return (
    // 문서 흐름상 풋터 바로 앞에 위치한 높이 0짜리 sticky 앵커 - 스크롤 중엔 화면 하단에 붙어있다가,
    // 풋터가 뷰포트에 들어오는 순간 자기 자리(풋터 바로 위)에서 멈춰 겹치지 않는다(JS 계산 불필요).
    // 레이아웃에는 공간을 차지하지 않도록 앵커는 h-0으로 두고, 실제 버튼/패널은 그 안에서 절대 위치로 띄운다.
    <div className="sticky inset-x-0 bottom-0 z-[100] h-0 overflow-visible">
      <div className="pointer-events-none absolute inset-x-0 bottom-6 flex flex-col items-end gap-4 px-6">
        {open && (
          <div className="pointer-events-auto flex h-[420px] w-[340px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-[#EDEDF0] bg-white shadow-[0_14px_38px_rgba(20,26,52,0.18)]">
            <div className="flex items-center justify-between border-b border-[#F0F0F0] px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-primary text-xs font-extrabold text-white">
                  AI
                </div>
                <span className="text-sm font-extrabold">시세 도우미</span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="시세 챗봇 닫기"
                className="text-[#9A9AA2] hover:text-ink"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div
              ref={scrollRef}
              className="chat-scroll flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto bg-[#FAFAFB] p-3"
            >
              {messages.length === 0 && (
                <div className="max-w-[85%] self-start rounded-[3px_12px_12px_12px] border border-[#EDEDF0] bg-white px-3 py-2.5 text-[13px] leading-normal">
                  카드 시세가 궁금하면 물어보세요!
                </div>
              )}

              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div
                    key={i}
                    className="max-w-[80%] self-end rounded-[12px_12px_3px_12px] bg-secondary px-3 py-2 text-[13px] leading-normal text-white"
                  >
                    {m.content}
                  </div>
                ) : (
                  <div key={i} className="max-w-[85%] self-start">
                    <div className="overflow-hidden rounded-[3px_12px_12px_12px] border border-[#EDEDF0] bg-white text-[13px] leading-normal">
                      {m.rankingItems ? (
                        <RankingList items={m.rankingItems} size="compact" />
                      ) : (
                        <div className="whitespace-pre-line px-3 py-2.5">{m.content}</div>
                      )}
                    </div>
                    {m.disclaimer && (
                      <div className="mt-1 rounded-lg border border-[#F5D9A8] bg-[#FFF7E8] px-2.5 py-1.5 text-[11px] font-semibold text-[#9A6A00]">
                        ⚠ {m.disclaimer}
                      </div>
                    )}
                  </div>
                ),
              )}

              {sending && (
                <div className="max-w-[85%] self-start rounded-[3px_12px_12px_12px] border border-[#EDEDF0] bg-white px-3 py-2.5 text-[13px] text-[#9A9AA2]">
                  답변 작성 중...
                </div>
              )}

              {error && (
                <div className="self-start rounded-lg border border-[#F5C2C0] bg-[#FDECEC] px-2.5 py-1.5 text-[11px] font-semibold text-[#C0392B]">
                  {error}
                </div>
              )}
            </div>

            {quickQuestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 border-t border-[#F0F0F0] px-3 py-2">
                {quickQuestions.map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    disabled={sending}
                    onClick={() => send(q.question, true)}
                    className="rounded-full border border-[#DDDDE3] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#4B4B55] hover:border-primary hover:text-primary disabled:opacity-50"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            )}

            <div className="border-t border-[#F0F0F0] px-3 py-2.5">
              <div className="flex items-center gap-2">
                <input
                  value={isLoggedIn ? draft : ""}
                  onChange={(e) => setDraft(e.target.value.slice(0, MAX_CHAT_MESSAGE_LENGTH))}
                  onFocus={() => {
                    if (!isLoggedIn) goToLogin();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSubmit();
                  }}
                  readOnly={!isLoggedIn}
                  maxLength={MAX_CHAT_MESSAGE_LENGTH}
                  aria-label="챗봇 메시지 입력"
                  placeholder={isLoggedIn ? "메시지를 입력하세요" : "로그인 후 질문할 수 있어요"}
                  className="flex-1 rounded-lg border border-[#DDDDE3] px-3 py-2 text-[13px] outline-none read-only:cursor-pointer read-only:bg-[#FAFAFB] read-only:text-[#9A9AA2]"
                />
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={sending || rateLimited || (isLoggedIn && !draft.trim())}
                  aria-label="메시지 전송"
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border-2 border-primary-dark bg-primary text-white disabled:opacity-50"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="2"
                  >
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                </button>
              </div>
              <div className="mt-1 text-right text-[10.5px] text-[#B0B0B8]">
                {(isLoggedIn ? draft : "").length}/{MAX_CHAT_MESSAGE_LENGTH}
              </div>
            </div>

            <button
              type="button"
              onClick={handleViewMore}
              className="block w-full border-t border-[#F0F0F0] px-3 py-2 text-center text-[12px] font-bold text-secondary hover:bg-[#FAFAFB]"
            >
              자세히 보기
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "시세 챗봇 닫기" : "시세 챗봇 열기"}
          className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-primary-dark bg-primary text-white shadow-tactile-sm transition-transform hover:scale-105 active:translate-y-0.5"
        >
          {open ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
