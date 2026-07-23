"use client";

import { useState } from "react";
import Link from "next/link";

const MENU = [
  ["대시보드", false],
  ["신고/제재 관리", true],
  ["회원 관리", false],
  ["거래 관리", false],
  ["정산 관리", false],
  ["공지 관리", false],
] as const;

const ROWS = [
  {
    id: "RP-4471",
    target: "불꽃컬렉터",
    type: "허위 상태 기재",
    reporter: "피카러버",
    time: "10분 전",
  },
  {
    id: "RP-4468",
    target: "카드왕김씨",
    type: "거래 후 연락 두절",
    reporter: "뮤츠마스터",
    time: "1시간 전",
  },
  {
    id: "RP-4465",
    target: "레어헌터",
    type: "위조 카드 판매",
    reporter: "진품감별사",
    time: "3시간 전",
  },
  {
    id: "RP-4460",
    target: "슈퍼트레이너",
    type: "욕설/비방",
    reporter: "평화주의자",
    time: "5시간 전",
  },
  { id: "RP-4455", target: "초보컬렉터", type: "중복 신고", reporter: "시세지킴이", time: "어제" },
];

const TABS = [
  ["wait", "대기중 14"],
  ["accept", "인정 62"],
  ["reject", "기각 23"],
] as const;

export default function ReportManagementPage() {
  const [tab, setTab] = useState("wait");
  const [open, setOpen] = useState(false);

  const tabCls = (a: boolean) =>
    `rounded-[10px] border-[1.5px] px-[15px] py-2 text-[13.5px] cursor-pointer ${a ? "border-primary bg-[#FFF5F5] font-bold text-primary" : "border-[#E4E4E9] bg-white font-semibold text-[#7A7A82]"}`;

  return (
    <>
      <main className="main-content flex bg-neutral">
        {/* admin sidebar */}
        <aside className="flex w-[230px] flex-shrink-0 flex-col gap-1 bg-navy px-4 py-[26px]">
          <div className="px-3 pb-3 text-[11px] font-extrabold tracking-[1px] text-[#6B7290]">
            관리자 콘솔
          </div>
          {MENU.map(([label, active]) => (
            <Link
              key={label}
              href="#"
              className={`flex items-center gap-[11px] rounded-[10px] px-[13px] py-[11px] text-sm ${
                active
                  ? "bg-primary font-bold text-white hover:text-white"
                  : "font-semibold text-[#A7ADC4] hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              <span
                className={`h-[7px] w-[7px] rounded-sm ${active ? "bg-white" : "bg-[#4B5478]"}`}
              />
              {label}
            </Link>
          ))}
        </aside>

        {/* content */}
        <div className="min-w-0 flex-1 px-9 py-8">
          <h1 className="mb-1 mt-0 text-2xl font-extrabold tracking-[-0.5px]">신고/제재 관리</h1>
          <p className="mb-[22px] text-[13.5px] text-[#8A8A92]">
            접수된 신고를 검토하고 제재를 적용합니다
          </p>

          <div className="mb-[18px] flex gap-2">
            {TABS.map(([k, l]) => (
              <button key={k} className={tabCls(tab === k)} onClick={() => setTab(k)}>
                {l}
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-[14px] border border-[#EDEDF0] bg-white">
            <div className="grid grid-cols-[1.1fr_1.4fr_1.2fr_1fr_1fr_0.9fr] gap-3.5 border-b border-[#EDEDF0] bg-[#FAFAFB] px-[22px] py-[13px] text-xs font-bold text-[#9A9AA2]">
              <div>신고번호</div>
              <div>대상</div>
              <div>유형</div>
              <div>신고자</div>
              <div>접수</div>
              <div>상태</div>
            </div>
            {ROWS.map((r, i, a) => (
              <div
                key={r.id}
                onClick={() => setOpen(true)}
                className={`grid cursor-pointer grid-cols-[1.1fr_1.4fr_1.2fr_1fr_1fr_0.9fr] items-center gap-3.5 px-[22px] py-[15px] text-[13.5px] hover:bg-[#FAFAFB] ${i < a.length - 1 ? "border-b border-[#F2F2F5]" : ""}`}
              >
                <div className="font-bold text-secondary">{r.id}</div>
                <div>{r.target}</div>
                <div>{r.type}</div>
                <div className="text-[#5A5A62]">{r.reporter}</div>
                <div className="text-[#9A9AA2]">{r.time}</div>
                <div>
                  <span className="rounded-full bg-[#FFF3CE] px-2.5 py-1 text-[11.5px] font-bold text-[#8A6A00]">
                    대기중
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* slide-in panel */}
      <div
        onClick={() => setOpen(false)}
        className="fixed inset-0 z-[70] bg-navy/35 transition-opacity duration-300"
        style={{ opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }}
      />
      <aside
        className="fixed bottom-0 right-0 top-0 z-[80] flex w-[420px] max-w-[92vw] flex-col overflow-y-auto bg-white shadow-panel transition-transform duration-300"
        style={{ transform: open ? "translateX(0)" : "translateX(100%)" }}
      >
        <div className="flex items-center justify-between border-b border-[#EDEDF0] px-6 py-[22px]">
          <div>
            <div className="text-xs font-semibold text-[#9A9AA2]">신고 상세</div>
            <div className="text-lg font-extrabold text-secondary">RP-4471</div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-[#F2F2F5] hover:bg-[#E4E4E9]"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#4B4B52"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex flex-col gap-5 p-6">
          <div className="rounded-[11px] border border-[#F6C6C6] bg-[#FFF1F1] px-4 py-3.5">
            <div className="text-xs font-bold text-[#C21414]">신고 유형</div>
            <div className="mt-[3px] text-[15px] font-extrabold text-[#C21414]">허위 상태 기재</div>
          </div>
          <div>
            <div className="mb-2 text-xs font-bold text-[#9A9AA2]">신고 대상</div>
            <div className="flex items-center gap-[11px]">
              <div className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-primary text-[13px] font-extrabold text-white">
                불꽃
              </div>
              <div>
                <div className="text-sm font-bold">불꽃컬렉터</div>
                <div className="text-xs text-[#9A9AA2]">누적 제재 1회 · 가입 2024.03</div>
              </div>
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-xs font-bold text-[#9A9AA2]">신고 내용</div>
            <p className="m-0 text-[13.5px] leading-[1.6] text-[#4B4B52]">
              S 등급으로 등록된 리자몽 ex 카드를 구매했으나, 실제 수령 카드는 모서리 손상이 뚜렷한
              상태였습니다. 검수 과정에서도 상태 불일치가 확인되었습니다.
            </p>
          </div>
          <div>
            <div className="mb-1.5 text-xs font-bold text-[#9A9AA2]">관련 거래</div>
            <div className="flex items-center justify-between rounded-[10px] bg-neutral px-3.5 py-3">
              <span className="text-[13px] font-bold">TX-20260720-4471</span>
              <span className="text-[13px] font-extrabold text-primary">₩142,000</span>
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs font-bold text-[#9A9AA2]">제재 수위</div>
            <select className="w-full cursor-pointer rounded-[10px] border border-[#DDDDE3] bg-white px-[13px] py-3 text-sm outline-none">
              <option>경고 (1회)</option>
              <option>거래 정지 7일</option>
              <option>거래 정지 30일</option>
              <option>영구 이용 정지</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2.5 border-t border-[#EDEDF0] px-6 py-[18px]">
          <button className="flex-1 rounded-[11px] border-2 border-primary-dark bg-primary py-3 text-[14.5px] font-bold text-white shadow-tactile-sm active:translate-y-0.5">
            인정 · 제재 적용
          </button>
          <button className="flex-1 rounded-[11px] border-[1.5px] border-[#DDDDE3] bg-white py-3 text-[14.5px] font-bold text-[#4B4B52] hover:border-[#8A8A92]">
            기각
          </button>
        </div>
      </aside>
    </>
  );
}
