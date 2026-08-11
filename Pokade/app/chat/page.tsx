"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@/hooks/useChat";
import { MAX_CHAT_MESSAGE_LENGTH } from "@/types/chat";

const CONVOS = [
  {
    av: "AI",
    bg: "bg-primary",
    name: "시세 도우미",
    msg: "카드 시세가 궁금하면 물어보세요",
    time: "방금",
    active: true,
    bold: true,
  },
  {
    av: "불꽃",
    bg: "bg-secondary",
    name: "불꽃컬렉터",
    msg: "네 발송 완료했습니다!",
    time: "2시간 전",
  },
  {
    av: "피카",
    bg: "bg-grade-a",
    name: "피카러버",
    msg: "가격 조금만 조정 가능할까요?",
    time: "어제",
  },
  { av: "뮤츠", bg: "bg-grade-b", name: "뮤츠마스터", msg: "거래 감사합니다 :)", time: "7월 20일" },
];

export default function ChatPage() {
  const { isLoggedIn, messages, quickQuestions, sending, error, send, goToLogin } = useChat();
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
      <div className="mx-auto max-w-[1200px]">
        <div className="grid h-[640px] grid-cols-[30fr_70fr] overflow-hidden rounded-2xl border border-[#EDEDF0] bg-white">
          {/* conversation list */}
          <div className="flex min-h-0 flex-col border-r border-[#EDEDF0]">
            <div className="border-b border-[#F0F0F0] px-[18px] pb-3.5 pt-[18px]">
              <h2 className="mb-3 mt-0 text-base font-extrabold">대화 목록</h2>
              <div className="flex items-center gap-2 rounded-[9px] border border-[#ECECEF] bg-neutral px-[11px] py-2">
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#9A9AA2"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4-4" />
                </svg>
                <input
                  placeholder="대화 검색"
                  className="w-full border-none bg-transparent text-[13px] outline-none"
                />
              </div>
            </div>
            <div className="chat-scroll min-h-0 flex-1 overflow-y-auto">
              {CONVOS.map((c) => (
                <div
                  key={c.name}
                  className={`flex cursor-pointer gap-3 px-[18px] py-3.5 ${c.active ? "border-l-[3px] border-primary bg-[#FFF5F5]" : "hover:bg-[#FAFAFB]"}`}
                >
                  <div
                    className={`flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-[11px] text-[13px] font-extrabold text-white ${c.bg}`}
                  >
                    {c.av}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between">
                      <span className={`text-[13.5px] ${c.bold ? "font-extrabold" : "font-bold"}`}>
                        {c.name}
                      </span>
                      <span className="text-[11px] text-[#B0B0B8]">{c.time}</span>
                    </div>
                    <p className="mt-[3px] truncate text-[12.5px] text-[#8A8A92]">{c.msg}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* chat window */}
          <div className="flex min-h-0 flex-col">
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
                    <div className="whitespace-pre-line rounded-[3px_14px_14px_14px] border border-[#EDEDF0] bg-white px-4 py-3.5 text-sm leading-normal">
                      {m.content}
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

            {/* FAQ 프리셋 질문 버튼 */}
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

            {/* input */}
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
                  aria-label="챗봇 메시지 입력"
                  placeholder={isLoggedIn ? "메시지를 입력하세요" : "로그인 후 자유롭게 질문할 수 있어요"}
                  className="flex-1 rounded-xl border border-[#DDDDE3] px-[15px] py-3 text-sm outline-none read-only:cursor-pointer read-only:bg-[#FAFAFB] read-only:text-[#9A9AA2]"
                />
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={sending || (isLoggedIn && !draft.trim())}
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
      </div>
    </main>
  );
}
