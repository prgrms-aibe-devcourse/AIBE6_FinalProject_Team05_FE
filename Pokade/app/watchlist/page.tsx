"use client";

import { useState } from "react";
import Link from "next/link";
import GradeBadge, { Grade } from "@/components/GradeBadge";
import CardImage from "@/components/CardImage";

type Status = "대기중" | "목표도달" | "확인함";
const STATUS_CLS: Record<Status, string> = {
  대기중: "bg-[#FFF3CE] text-[#8A6A00]",
  목표도달: "bg-[#E8F7EF] text-[#087a4e]",
  확인함: "bg-[#EEF0F2] text-[#6B7280]",
};

const ROWS: {
  id: string;
  name: string;
  set: string;
  grade: Grade;
  price: string;
  target: string;
  chg: string;
  up: boolean;
  status: Status;
}[] = [
  {
    id: "wl-1",
    name: "리자몽 ex",
    set: "흑염의 지배자 · SAR",
    grade: "S",
    price: "₩142,000",
    target: "₩150,000",
    chg: "▲ 3.2%",
    up: true,
    status: "대기중",
  },
  {
    id: "wl-2",
    name: "뮤 UR",
    set: "151 · UR",
    grade: "A",
    price: "₩89,500",
    target: "₩85,000",
    chg: "▼ 1.4%",
    up: false,
    status: "목표도달",
  },
  {
    id: "wl-3",
    name: "피카츄 VMAX",
    set: "프로모 · HR",
    grade: "S",
    price: "₩55,000",
    target: "₩52,000",
    chg: "▲ 5.8%",
    up: true,
    status: "목표도달",
  },
  {
    id: "wl-4",
    name: "뮤츠 ex",
    set: "레이징 서프 · SAR",
    grade: "A",
    price: "₩211,000",
    target: "₩220,000",
    chg: "▲ 1.1%",
    up: true,
    status: "확인함",
  },
  {
    id: "wl-5",
    name: "이상해꽃 ex",
    set: "클레이 버스트 · SAR",
    grade: "S",
    price: "₩64,200",
    target: "₩70,000",
    chg: "▲ 2.5%",
    up: true,
    status: "대기중",
  },
];

const TABS = [
  ["all", "전체 12"],
  ["wait", "대기중 8"],
  ["reached", "목표도달 3"],
  ["seen", "확인함 1"],
] as const;

export default function WatchlistPage() {
  const [empty, setEmpty] = useState(false);
  const [filter, setFilter] = useState("all");

  const tabCls = (active: boolean) =>
    `rounded-[10px] border-[1.5px] px-[15px] py-2 text-[13.5px] cursor-pointer ${
      active
        ? "border-primary bg-[#FFF5F5] font-bold text-primary"
        : "border-[#E4E4E9] bg-white font-semibold text-[#7A7A82]"
    }`;

  return (
    <main className="main-content bg-neutral px-10 pb-14 pt-9">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-[22px] flex items-end justify-between">
          <div>
            <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.6px]">워치리스트</h1>
            <p className="mt-1.5 text-sm text-[#8A8A92]">
              관심 카드의 목표가 도달 알림을 관리하세요
            </p>
          </div>
          <button
            onClick={() => setEmpty((e) => !e)}
            className="rounded-[10px] border-[1.5px] border-[#DDDDE3] bg-white px-[15px] py-[9px] text-[13px] font-bold text-[#8A8A92] hover:border-primary hover:text-primary"
          >
            데모: 빈 상태 전환
          </button>
        </div>

        <div className="mb-[18px] flex gap-2">
          {TABS.map(([k, l]) => (
            <button key={k} className={tabCls(filter === k)} onClick={() => setFilter(k)}>
              {l}
            </button>
          ))}
        </div>

        {!empty ? (
          <div className="overflow-hidden rounded-2xl border border-[#EDEDF0] bg-white">
            <div className="grid grid-cols-[2.4fr_1fr_1fr_1fr_1fr_0.6fr] gap-4 border-b border-[#EDEDF0] bg-[#FAFAFB] px-[22px] py-3.5 text-xs font-bold text-[#9A9AA2]">
              <div>카드</div>
              <div>현재 시세</div>
              <div>목표가</div>
              <div>등락</div>
              <div>상태</div>
              <div />
            </div>
            {ROWS.map((r, i) => (
              <div
                key={r.id}
                className={`grid grid-cols-[2.4fr_1fr_1fr_1fr_1fr_0.6fr] items-center gap-4 px-[22px] py-4 hover:bg-[#FAFAFB] ${i < ROWS.length - 1 ? "border-b border-[#F2F2F5]" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-14 w-10 flex-shrink-0 overflow-hidden rounded-[7px] bg-[#F2F2F5]">
                    <CardImage />
                  </div>
                  <div>
                    <div className="text-sm font-bold">{r.name}</div>
                    <div className="text-xs text-[#9A9AA2]">{r.set}</div>
                  </div>
                </div>
                <div className="text-sm font-bold">{r.price}</div>
                <div className="text-sm text-[#4B4B52]">{r.target}</div>
                <div
                  className={`text-[13.5px] font-bold ${r.up ? "text-primary" : "text-secondary"}`}
                >
                  {r.chg}
                </div>
                <div>
                  <span
                    className={`rounded-full px-[11px] py-[5px] text-xs font-bold ${STATUS_CLS[r.status]}`}
                  >
                    {r.status}
                  </span>
                </div>
                <div className="text-right">
                  <button aria-label="삭제" className="text-[#C7C7CE] hover:text-primary">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 19a2 2 0 002 2h8a2 2 0 002-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-[#EDEDF0] bg-white px-10 py-[72px] text-center">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[#F2F2F5]">
              <svg
                width="46"
                height="46"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#C7C7CE"
                strokeWidth="1.6"
              >
                <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 000-7.8z" />
              </svg>
            </div>
            <h3 className="mb-0 mt-[22px] text-lg font-extrabold">아직 관심 카드가 없어요</h3>
            <p className="mt-2.5 text-sm leading-relaxed text-[#8A8A92]">
              마켓에서 카드를 찾아 하트를 눌러보세요.
              <br />
              목표가에 도달하면 알림을 보내드립니다.
            </p>
            <Link
              href="/"
              className="mt-[26px] inline-block rounded-[11px] border-2 border-primary-dark bg-primary px-[26px] py-3 text-[14.5px] font-bold text-white shadow-tactile-sm hover:text-white"
            >
              카드 둘러보기
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
