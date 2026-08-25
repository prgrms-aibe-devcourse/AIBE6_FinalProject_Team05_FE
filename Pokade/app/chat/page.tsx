"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@/hooks/useChat";
import { MAX_CHAT_MESSAGE_LENGTH } from "@/types/chat";
import RankingList from "@/components/RankingList";

export default function ChatPage() {
  const { isLoggedIn, messages, quickQuestions, sending, error, rateLimited, send, goToLogin } =
    useChat();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, sending]);

  function handleSubmit() {
    if (sending) return;
    if (!isLoggedIn) {
      goToLogin();
      return;
    }
    send(draft, false);
    setDraft("");
  }

  return (
    <main className="main-content bg-neutral px-10 pb-10 pt-7">
      <div className="mx-auto max-w-[720px]">
        <div className="flex h-[640px] flex-col overflow-hidden rounded-2xl border border-[#EDEDF0] bg-white">
          <div className="flex items-center gap-3 border-b border-[#F0F0F0] px-[22px] py-[15px]">
            <div className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] bg-primary text-[13px] font-extrabold text-white">
              AI
            </div>
            <div>
              <div className="text-[14.5px] font-extrabold">시세 도우미</div>
              <div className="flex items-center gap-[5px] text-xs font-semibold text-[#059669]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#059669]" />
                실시간 응답
              </div>
            </div>
          </div>

          <div
            ref={scrollRef}
            className="chat-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-[#FAFAFB] p-[22px]"
          >
            {messages.length === 0 && (
              <div className="max-w-[78%] self-start rounded-[3px_14px_14px_14px] border border-[#EDEDF0] bg-white px-4 py-3.5 text-sm leading-normal">
                카드 시세가 궁금하면 자유롭게 물어보세요! 아래 버튼으로도 바로 물어볼 수 있어요.
              </div>
            )}

            {messages.map((m, i) =>
              m.role === "user" ? (
                <div
                  key={i}
                  className="max-w-[64%] self-end rounded-[14px_14px_3px_14px] bg-secondary px-[15px] py-3 text-sm leading-normal text-white"
                >
                  {m.content}
                </div>
              ) : (
                <div key={i} className="max-w-[78%] self-start">
                  <div className="overflow-hidden rounded-[3px_14px_14px_14px] border border-[#EDEDF0] bg-white text-sm leading-normal">
                    {m.rankingItems ? (
                      <RankingList items={m.rankingItems} size="default" />
                    ) : (
                      <div className="whitespace-pre-line px-4 py-3.5">{m.content}</div>
                    )}
                  </div>
                  {m.disclaimer && (
                    <div className="mt-1.5 rounded-lg border border-[#F5D9A8] bg-[#FFF7E8] px-3 py-2 text-xs font-semibold text-[#9A6A00]">
                      ⚠ {m.disclaimer}
                    </div>
                  )}
                </div>
              ),
            )}

            {sending && (
              <div className="max-w-[78%] self-start rounded-[3px_14px_14px_14px] border border-[#EDEDF0] bg-white px-4 py-3.5 text-sm leading-normal text-[#9A9AA2]">
                답변 작성 중...
              </div>
            )}

            {error && (
              <div className="self-start rounded-lg border border-[#F5C2C0] bg-[#FDECEC] px-3 py-2 text-xs font-semibold text-[#C0392B]">
                {error}
              </div>
            )}
          </div>

          {quickQuestions.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t border-[#F0F0F0] px-[18px] py-3">
              {quickQuestions.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  disabled={sending}
                  onClick={() => send(q.question, true)}
                  className="rounded-full border border-[#DDDDE3] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#4B4B55] hover:border-primary hover:text-primary disabled:opacity-50"
                >
                  {q.label}
                </button>
              ))}
            </div>
          )}

          <div className="border-t border-[#F0F0F0] px-[18px] py-3.5">
            <div className="flex items-center gap-2.5">
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
                aria-label="채팅 메시지 입력"
                placeholder={isLoggedIn ? "시세를 물어보세요" : "로그인 후 자유롭게 질문할 수 있어요"}
                className="flex-1 rounded-xl border border-[#DDDDE3] px-[15px] py-3 text-sm outline-none read-only:cursor-pointer read-only:bg-[#FAFAFB] read-only:text-[#9A9AA2]"
              />
              <button
                type="button"
                onClick={handleSubmit}
                disabled={sending || rateLimited || (isLoggedIn && !draft.trim())}
                className="flex h-[46px] w-[46px] flex-shrink-0 items-center justify-center rounded-xl border-2 border-primary-dark bg-primary text-white shadow-tactile-sm active:translate-y-0.5 disabled:opacity-50"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2"
                >
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
              </button>
            </div>
            <div className="mt-1 text-right text-[11px] text-[#B0B0B8]">
              {(isLoggedIn ? draft : "").length}/{MAX_CHAT_MESSAGE_LENGTH}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
