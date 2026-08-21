"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@/hooks/useChat";
import { MAX_CHAT_MESSAGE_LENGTH } from "@/types/chat";
import RankingList from "@/components/RankingList";

interface MockMessage {
  me: boolean;
  text: string;
}

interface Convo {
  id: string;
  av: string;
  bg: string;
  name: string;
  msg: string;
  time: string;
  lastSeen?: string;
  thread?: MockMessage[];
}

// "시세 도우미"(id: "ai")만 실제 챗봇 API와 연결된다. 나머지는 목데이터로 꾸민 거래 상대방 대화 예시.
const CONVOS: Convo[] = [
  {
    id: "ai",
    av: "AI",
    bg: "bg-primary",
    name: "시세 도우미",
    msg: "카드 시세가 궁금하면 물어보세요",
    time: "방금",
  },
  {
    id: "flame-collector",
    av: "불꽃",
    bg: "bg-secondary",
    name: "불꽃컬렉터",
    msg: "네 발송 완료했습니다!",
    time: "2시간 전",
    lastSeen: "2시간 전 접속",
    thread: [
      { me: true, text: "안녕하세요! 리자몽 ex SAR 구매 확정했습니다." },
      { me: false, text: "안녕하세요~ 확인했습니다! 오늘 안으로 택배 발송해드릴게요." },
      { me: true, text: "감사합니다. 검수 있으니 포장 꼼꼼히 부탁드려요 :)" },
      { me: false, text: "그럼요, 에어캡으로 이중 포장해서 보내드립니다." },
      { me: false, text: "네 발송 완료했습니다! 송장번호 1234-5678-9012 입니다." },
    ],
  },
  {
    id: "pika-lover",
    av: "피카",
    bg: "bg-grade-a",
    name: "피카러버",
    msg: "가격 조금만 조정 가능할까요?",
    time: "어제",
    lastSeen: "어제 접속",
    thread: [
      { me: false, text: "안녕하세요, 등록하신 피카츄 프로모 카드 관심있어요!" },
      { me: true, text: "안녕하세요~ 상태 A등급이고 사진 그대로예요." },
      { me: false, text: "혹시 가격 조금만 조정 가능할까요? 5만원에 어떠세요?" },
      { me: true, text: "음.. 5만 2천원이면 바로 진행할게요." },
      { me: false, text: "좋아요! 바로 안전결제 진행하겠습니다." },
    ],
  },
  {
    id: "mewtwo-master",
    av: "뮤츠",
    bg: "bg-grade-b",
    name: "뮤츠마스터",
    msg: "거래 감사합니다 :)",
    time: "7월 20일",
    lastSeen: "7월 20일 접속",
    thread: [
      { me: false, text: "카드 잘 받았습니다! 상태도 설명하신 그대로네요." },
      { me: true, text: "다행이네요 ㅎㅎ 구매확정 도와주시면 정산 진행돼요." },
      { me: false, text: "네 방금 구매확정 눌렀어요!" },
      { me: false, text: "거래 감사합니다 :) 다음에 또 좋은 상품 있으면 연락드릴게요." },
    ],
  },
  {
    id: "gyarados-trainer",
    av: "갸라",
    bg: "bg-tertiary",
    name: "갸라도스트레이너",
    msg: "택배 상태가 사진이랑 달라서요...",
    time: "3일 전",
    lastSeen: "3일 전 접속",
    thread: [
      { me: false, text: "안녕하세요, 오늘 카드 수령했는데 모서리가 사진보다 상해있어요." },
      { me: false, text: "택배 상태도 박스가 좀 찌그러져 있었고요." },
      { me: true, text: "이런, 불편을 드려 죄송해요. 검수 요청 넣어드릴게요." },
      { me: true, text: "고객센터(010-2222-2222)로도 사진 보내주시면 더 빠르게 확인 가능해요." },
    ],
  },
  {
    id: "charizard-mania",
    av: "리자몽",
    bg: "bg-grade-s",
    name: "리자몽매니아",
    msg: "새 상품 올라오면 알려주세요!",
    time: "1주 전",
    lastSeen: "1주 전 접속",
    thread: [
      { me: false, text: "관심목록에 리자몽 ex 추가해뒀어요, 새 상품 올라오면 알려주세요!" },
      { me: true, text: "넵! 등록되는 대로 채팅으로 안내드릴게요." },
      { me: false, text: "감사합니다 :) S등급으로 부탁드려요." },
    ],
  },
];

export default function ChatPage() {
  const { isLoggedIn, messages, quickQuestions, sending, error, rateLimited, send, goToLogin } =
    useChat();
  const [draft, setDraft] = useState("");
  const [activeId, setActiveId] = useState("ai");
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeConvo = CONVOS.find((c) => c.id === activeId) ?? CONVOS[0];
  const isAiThread = activeId === "ai";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, sending, activeId]);

  function handleSubmit() {
    if (!isAiThread || sending) return;
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
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className={`flex cursor-pointer gap-3 px-[18px] py-3.5 ${c.id === activeId ? "border-l-[3px] border-primary bg-[#FFF5F5]" : "hover:bg-[#FAFAFB]"}`}
                >
                  <div
                    className={`flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-[11px] text-[13px] font-extrabold text-white ${c.bg}`}
                  >
                    {c.av}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between">
                      <span
                        className={`text-[13.5px] ${c.id === activeId ? "font-extrabold" : "font-bold"}`}
                      >
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
              <div
                className={`flex h-[38px] w-[38px] items-center justify-center rounded-[10px] text-[13px] font-extrabold text-white ${activeConvo.bg}`}
              >
                {activeConvo.av}
              </div>
              <div>
                <div className="text-[14.5px] font-extrabold">{activeConvo.name}</div>
                {isAiThread ? (
                  <div className="flex items-center gap-[5px] text-xs font-semibold text-[#059669]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#059669]" />
                    실시간 응답
                  </div>
                ) : (
                  <div className="text-xs font-semibold text-[#9A9AA2]">
                    {activeConvo.lastSeen}
                  </div>
                )}
              </div>
            </div>

            <div
              ref={scrollRef}
              className="chat-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-[#FAFAFB] p-[22px]"
            >
              {isAiThread ? (
                <>
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
                </>
              ) : (
                activeConvo.thread?.map((m, i) => (
                  <div
                    key={i}
                    className={
                      m.me
                        ? "max-w-[64%] self-end rounded-[14px_14px_3px_14px] bg-secondary px-[15px] py-3 text-sm leading-normal text-white"
                        : "max-w-[78%] self-start rounded-[3px_14px_14px_14px] border border-[#EDEDF0] bg-white px-4 py-3.5 text-sm leading-normal"
                    }
                  >
                    {m.text}
                  </div>
                ))
              )}
            </div>

            {/* FAQ 프리셋 질문 버튼 - AI 챗봇 대화에서만 노출 */}
            {isAiThread && quickQuestions.length > 0 && (
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

            {/* input - 목데이터 대화는 예시일 뿐이라 읽기 전용으로 둔다 */}
            <div className="border-t border-[#F0F0F0] px-[18px] py-3.5">
              <div className="flex items-center gap-2.5">
                <input
                  value={isAiThread && isLoggedIn ? draft : ""}
                  onChange={(e) => setDraft(e.target.value.slice(0, MAX_CHAT_MESSAGE_LENGTH))}
                  onFocus={() => {
                    if (isAiThread && !isLoggedIn) goToLogin();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSubmit();
                  }}
                  readOnly={!isAiThread || !isLoggedIn}
                  maxLength={MAX_CHAT_MESSAGE_LENGTH}
                  aria-label="채팅 메시지 입력"
                  placeholder={
                    !isAiThread
                      ? "지난 대화 예시입니다 (읽기 전용)"
                      : isLoggedIn
                        ? "메시지를 입력하세요"
                        : "로그인 후 자유롭게 질문할 수 있어요"
                  }
                  className="flex-1 rounded-xl border border-[#DDDDE3] px-[15px] py-3 text-sm outline-none read-only:cursor-pointer read-only:bg-[#FAFAFB] read-only:text-[#9A9AA2]"
                />
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!isAiThread || sending || rateLimited || (isLoggedIn && !draft.trim())}
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
