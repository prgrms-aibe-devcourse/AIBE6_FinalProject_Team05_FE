"use client";

import { useState } from "react";
import Link from "next/link";
import GradeBadge from "@/components/GradeBadge";
import CardImage from "@/components/CardImage";

const STEPS = [
  { label: "결제 완료", state: "done" },
  { label: "판매자 발송", state: "done" },
  { label: "검수센터 검수", state: "active" },
  { label: "배송 중", state: "todo" },
  { label: "수령 완료", state: "todo" },
];

export default function TradeStatusPage() {
  const [failed, setFailed] = useState(false);

  return (
    <main className="main-content bg-neutral px-10 pb-14 pt-9">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-2 flex items-center gap-2.5 text-[13px] text-[#9A9AA2]">
          <Link href="#" className="text-[#9A9AA2] hover:text-primary">
            거래 내역
          </Link>
          <span>›</span>
          <span className="font-semibold text-[#4B4B52]">거래 상세</span>
        </div>
        <h1 className="mb-6 text-[26px] font-extrabold tracking-[-0.6px]">거래 진행 상황</h1>

        <div className="grid grid-cols-[60fr_40fr] items-start gap-[22px]">
          {/* LEFT */}
          <div className="flex flex-col gap-5">
            {failed && (
              <div className="flex items-start gap-3 rounded-[14px] border border-[#F6C6C6] bg-[#FFF1F1] px-5 py-[18px]">
                <svg
                  className="mt-px flex-shrink-0"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#EE1515"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
                <div>
                  <div className="text-[15px] font-extrabold text-[#C21414]">
                    검수 불합격 — 위반 2건
                  </div>
                  <p className="mt-1.5 text-[13.5px] leading-[1.55] text-[#8A5A5A]">
                    등록된 상태 정보와 실물이 일치하지 않아 검수를 통과하지 못했습니다. 판매자에게
                    자동으로 반송 처리됩니다.
                  </p>
                  <div className="mt-2.5 flex gap-2">
                    {["모서리 손상 (미고지)", "표면 스크래치"].map((v) => (
                      <span
                        key={v}
                        className="rounded-full border border-[#F0C4C4] bg-white px-2.5 py-1 text-xs font-bold text-[#C21414]"
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* stepper */}
            <div className="rounded-2xl border border-t-[3px] border-[#EDEDF0] border-t-secondary bg-white px-7 py-[26px]">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="m-0 text-base font-extrabold">거래 상태</h2>
                <span className="rounded-full bg-lavender px-[11px] py-[5px] text-[12.5px] font-bold text-secondary">
                  검수 진행중
                </span>
              </div>
              <div className="relative flex justify-between">
                <div className="absolute left-[8%] right-[8%] top-[15px] z-0 h-0.5 bg-[#E7E7EB]" />
                <div className="absolute left-[8%] top-[15px] z-0 h-0.5 w-[42%] bg-secondary" />
                {STEPS.map((s, i) => {
                  const circle =
                    s.state === "done"
                      ? "bg-secondary text-white"
                      : s.state === "active"
                        ? "bg-secondary text-white shadow-[0_0_0_4px_#EEF0FA]"
                        : "bg-[#EDEDF0] text-[#A8A8B0]";
                  const label =
                    s.state === "active"
                      ? "font-extrabold text-secondary"
                      : s.state === "done"
                        ? "font-bold text-ink"
                        : "font-semibold text-[#A8A8B0]";
                  return (
                    <div
                      key={s.label}
                      className="relative z-[1] flex flex-1 flex-col items-center gap-2"
                    >
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold ${circle}`}
                      >
                        {s.state === "done" ? "✓" : i + 1}
                      </div>
                      <span className={`text-center text-xs ${label}`}>{s.label}</span>
                    </div>
                  );
                })}
              </div>

              {/* countdown gold */}
              <div className="mt-[26px] flex items-center justify-between rounded-xl border border-[#F5E4A8] bg-[#FFF9E6] px-[18px] py-4">
                <div className="flex items-center gap-[11px]">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#B8860B"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                  <span className="text-[13.5px] font-bold text-[#8A6A00]">검수 완료 예정까지</span>
                </div>
                <div className="text-[22px] font-extrabold tabular-nums tracking-[0.5px] text-[#B8860B]">
                  11:42:08
                </div>
              </div>
            </div>

            {/* log */}
            <div className="rounded-2xl border border-[#EDEDF0] bg-white px-7 py-6">
              <h2 className="mb-[18px] mt-0 text-base font-extrabold">진행 기록</h2>
              <div className="flex flex-col gap-4">
                {[
                  { t: "검수센터 도착 · 검수 시작", d: "2026년 7월 22일 · 3시간 전", cur: true },
                  {
                    t: "판매자 발송 완료 (CJ대한통운 6821-XXXX)",
                    d: "2026년 7월 21일",
                    cur: false,
                  },
                  { t: "결제 완료 · 안전결제 예치", d: "2026년 7월 20일", cur: false },
                ].map((e) => (
                  <div key={e.t} className="flex gap-3.5">
                    <div
                      className={`mt-[5px] h-[9px] w-[9px] flex-shrink-0 rounded-full ${e.cur ? "bg-secondary" : "bg-[#C7C7CE]"}`}
                    />
                    <div>
                      <div
                        className={`text-sm ${e.cur ? "font-bold" : "font-semibold text-[#4B4B52]"}`}
                      >
                        {e.t}
                      </div>
                      <div className="mt-0.5 text-[12.5px] text-[#9A9AA2]">{e.d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="flex flex-col gap-5">
            <div className="rounded-2xl border border-[#EDEDF0] bg-white p-6">
              <h2 className="mb-4 mt-0 text-[15px] font-extrabold">거래 카드</h2>
              <div className="flex gap-4">
                <div className="relative h-[132px] w-24 flex-shrink-0 overflow-hidden rounded-[10px] bg-[#F2F2F5]">
                  <CardImage />
                  <GradeBadge grade="S" size="sm" className="absolute left-[7px] top-[7px]" />
                </div>
                <div className="flex-1">
                  <div className="text-[15.5px] font-extrabold">리자몽 ex</div>
                  <div className="mt-[3px] text-[12.5px] text-[#9A9AA2]">흑염의 지배자 · SAR</div>
                  <div className="mt-3.5 text-xs text-[#9A9AA2]">결제 금액</div>
                  <div className="text-xl font-extrabold text-primary">₩142,000</div>
                </div>
              </div>
              <div className="my-5 h-px bg-[#EDEDF0]" />
              <div className="flex flex-col gap-[11px] text-[13.5px]">
                {[
                  ["거래 번호", "TX-20260720-4471"],
                  ["판매자", "불꽃컬렉터"],
                  ["배송 방식", "검수 후 안전배송"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-[#8A8A92]">{k}</span>
                    <span className="font-bold">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-[#EDEDF0] bg-white p-6">
              <h2 className="mb-3.5 mt-0 text-[15px] font-extrabold">결제 정보</h2>
              <div className="flex flex-col gap-2.5 text-[13.5px]">
                {[
                  ["상품 금액", "₩142,000"],
                  ["안전거래 수수료", "₩4,260"],
                  ["배송비", "₩3,000"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-[#8A8A92]">{k}</span>
                    <span className="font-semibold">{v}</span>
                  </div>
                ))}
                <div className="my-1 h-px bg-[#EDEDF0]" />
                <div className="flex items-baseline justify-between">
                  <span className="font-bold">총 결제 금액</span>
                  <span className="text-[17px] font-extrabold text-primary">₩149,260</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-[11px]">
              <button className="w-full rounded-xl border-2 border-primary-dark bg-primary py-[15px] text-[15.5px] font-bold text-white shadow-tactile transition active:translate-y-0.5 active:shadow-tactile-active">
                수령 확인
              </button>
              <button
                onClick={() => setFailed((f) => !f)}
                className="w-full rounded-xl border-[1.5px] border-[#DDDDE3] bg-white py-[15px] text-[15px] font-bold text-[#4B4B52] hover:border-primary hover:text-primary"
              >
                문제 신고
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
