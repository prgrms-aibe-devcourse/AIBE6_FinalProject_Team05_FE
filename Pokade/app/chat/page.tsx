import GradeBadge, { Grade } from "@/components/GradeBadge";
import CardImage from "@/components/CardImage";

const CONVOS = [
  {
    av: "AI",
    bg: "bg-primary",
    name: "시세 도우미",
    msg: "리자몽 ex 최근 시세를 알려드릴게요",
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

const RESULTS: { id: string; grade: Grade; price: string }[] = [
  { id: "cb-1", grade: "S", price: "₩142,000" },
  { id: "cb-2", grade: "A", price: "₩98,000" },
  { id: "cb-3", grade: "B", price: "₩61,000" },
];

export default function ChatPage() {
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

            <div className="chat-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-[#FAFAFB] p-[22px]">
              <div className="max-w-[64%] self-end rounded-[14px_14px_3px_14px] bg-secondary px-[15px] py-3 text-sm leading-normal text-white">
                리자몽 ex 카드 좀 찾아줘
              </div>

              <div className="max-w-[78%] self-start">
                <div className="rounded-[3px_14px_14px_14px] border border-[#EDEDF0] bg-white px-4 py-3.5 text-sm leading-normal">
                  &quot;리자몽 ex&quot; 검색 결과예요. 등급별로 3개 카드를 찾았어요.
                  <div className="mt-3 grid grid-cols-3 gap-2.5">
                    {RESULTS.map((r) => (
                      <div
                        key={r.id}
                        className="overflow-hidden rounded-[10px] border border-[#EDEDF0]"
                      >
                        <div className="relative h-24 bg-[#F2F2F5]">
                          <CardImage />
                          <GradeBadge
                            grade={r.grade}
                            size="sm"
                            className="absolute left-1.5 top-1.5"
                          />
                        </div>
                        <div className="p-2">
                          <div className="text-[11.5px] font-bold">리자몽 ex</div>
                          <div className="mt-0.5 text-xs font-extrabold text-primary">
                            {r.price}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-[5px] text-[11px] text-[#B0B0B8]">오후 2:14</div>
              </div>

              <div className="max-w-[64%] self-end rounded-[14px_14px_3px_14px] bg-secondary px-[15px] py-3 text-sm leading-normal text-white">
                최근 시세 흐름은 어때?
              </div>

              <div className="max-w-[78%] self-start">
                <div className="rounded-[3px_14px_14px_14px] border border-[#EDEDF0] bg-white px-4 py-3.5 text-sm leading-normal">
                  리자몽 ex(S)는 지난 7일간 <b className="text-primary">+3.2%</b> 상승했어요. 최근
                  30일 흐름이에요.
                  <div className="mt-3 rounded-[10px] border border-[#EDEDF0] bg-[#FAFAFB] p-3">
                    <div className="mb-2 flex items-baseline justify-between">
                      <span className="text-xs font-semibold text-[#9A9AA2]">30일 시세</span>
                      <span className="text-[15px] font-extrabold">₩142,000</span>
                    </div>
                    <svg width="100%" height="56" viewBox="0 0 300 56" preserveAspectRatio="none">
                      <polyline
                        points="0,44 40,40 80,46 120,34 160,38 200,26 240,22 300,10"
                        fill="none"
                        stroke="#EE1515"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
                <div className="mt-[5px] text-[11px] text-[#B0B0B8]">오후 2:15</div>
              </div>
            </div>

            {/* input */}
            <div className="flex items-center gap-2.5 border-t border-[#F0F0F0] px-[18px] py-3.5">
              <input
                placeholder="메시지를 입력하세요"
                className="flex-1 rounded-xl border border-[#DDDDE3] px-[15px] py-3 text-sm outline-none"
              />
              <button className="flex h-[46px] w-[46px] flex-shrink-0 items-center justify-center rounded-xl border-2 border-primary-dark bg-primary text-white shadow-tactile-sm active:translate-y-0.5">
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
          </div>
        </div>
      </div>
    </main>
  );
}
