"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import GradeBadge, { Grade } from "@/components/GradeBadge";
import CardImage from "@/components/CardImage";
import { CardSearchItem, toCardSearchItem } from "@/types/card";
import { fetchCards, fetchCardsByKeyword } from "@/lib/cardApi";
import { ApiError } from "@/lib/apiClient";

const GRADE_CHIP: Record<Grade, string> = {
  S: "text-[#5A4300] bg-[#FFF3CE] border-[#F0E0A0]",
  A: "text-secondary bg-lavender border-[#D4D9F5]",
  B: "text-[#6B7280] bg-[#EEF0F2] border-[#DCDFE3]",
};

const PRICE_MAX = 3000000;

// 세트 체크박스 → BE expansionId 매핑. data.sql에 실제 시드된 세트 중 4개만 노출.
const SET_OPTIONS: { label: string; expansionId: string }[] = [
  { label: "베이스", expansionId: "base1" },
  { label: "151", expansionId: "sv3pt5" },
  { label: "블랙 볼트", expansionId: "zsv10pt5" },
  { label: "메가 에볼루션", expansionId: "me1" },
];

type LoadState = "loading" | "error" | "ready";

export default function SearchDashboardPage() {
  return (
    <Suspense fallback={null}>
      <SearchDashboard />
    </Suspense>
  );
}

function SearchDashboard() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q")?.trim() || "";
  const [view, setView] = useState<"search" | "dash">("search");
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(1500000);
  const [selectedExpansionId, setSelectedExpansionId] = useState<string | null>(null);
  const [cards, setCards] = useState<CardSearchItem[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [prevQ, setPrevQ] = useState(q);
  if (q !== prevQ) {
    setPrevQ(q);
    setLoadState("loading");
  }

  useEffect(() => {
    let cancelled = false;

    const request = q
      ? fetchCardsByKeyword(q)
      : fetchCards({ expansionId: selectedExpansionId ?? undefined });

    request
      .then((responses) => {
        if (cancelled) return;
        setCards(responses.map(toCardSearchItem));
        setLoadState("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMessage(err instanceof ApiError ? err.message : "카드 목록을 불러오지 못했습니다.");
        setLoadState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey, selectedExpansionId, q]);

  const resetFilters = () => {
    setPriceMin(0);
    setPriceMax(1500000);
    setLoadState("loading");
    setSelectedExpansionId(null);
  };
  const seg = (a: boolean) =>
    `rounded-lg px-[18px] py-[9px] text-[13.5px] cursor-pointer ${a ? "bg-white font-bold text-ink shadow-[0_1px_3px_rgba(0,0,0,0.08)]" : "bg-transparent font-semibold text-[#8A8A92]"}`;

  return (
    <main className="main-content bg-neutral px-10 pb-14 pt-8">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-[22px] flex items-center justify-between">
          <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.6px]">
            {q ? `"${q}" 검색 결과` : "카드 검색 & 시세"}
          </h1>
          {!q && (
            <div className="flex rounded-[10px] bg-[#EDEDF0] p-1">
              <button className={seg(view === "search")} onClick={() => setView("search")}>
                카드 검색
              </button>
              <button className={seg(view === "dash")} onClick={() => setView("dash")}>
                시세 대시보드
              </button>
            </div>
          )}
        </div>

        {(q || view === "search") && (
          <div className={`grid items-start gap-6 ${q ? "grid-cols-1" : "grid-cols-[250px_1fr]"}`}>
            {/* filter sidebar — 키워드 검색 중에는 세트 필터와 동시 적용하지 않으므로 숨김 */}
            {!q && (
              <div className="sticky top-[88px] rounded-2xl border border-[#EDEDF0] bg-white p-[22px]">
                <div className="mb-4 text-[15px] font-extrabold">필터</div>
                <div className="mb-[9px] text-[12.5px] font-bold text-[#4B4B52]">세트</div>
                <div className="mb-5 flex flex-col gap-[9px]">
                  {SET_OPTIONS.map((opt) => (
                    <label
                      key={opt.expansionId}
                      className="flex cursor-pointer items-center gap-2 text-[13px] text-[#5A5A62]"
                    >
                      <input
                        type="radio"
                        name="expansion-filter"
                        checked={selectedExpansionId === opt.expansionId}
                        onChange={() => {
                          setLoadState("loading");
                          setSelectedExpansionId((prev) =>
                            prev === opt.expansionId ? null : opt.expansionId,
                          );
                        }}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
                <div className="mb-[18px] h-px bg-[#F0F0F0]" />
                <div className="mb-[9px] text-[12.5px] font-bold text-[#4B4B52]">등급</div>
                <div className="mb-5 flex flex-wrap gap-[7px]">
                  {(["S", "A", "B"] as Grade[]).map((g) => (
                    <span
                      key={g}
                      className={`cursor-pointer rounded-full border px-2.5 py-1 text-[11.5px] font-bold ${GRADE_CHIP[g]}`}
                    >
                      {g}
                    </span>
                  ))}
                </div>
                <div className="mb-[18px] h-px bg-[#F0F0F0]" />
                <div className="mb-3 text-[12.5px] font-bold text-[#4B4B52]">가격대</div>
                <div className="mb-3 flex justify-between text-[12.5px] font-bold text-ink">
                  <span>{priceMin.toLocaleString("ko-KR")}원</span>
                  <span>~</span>
                  <span>{priceMax.toLocaleString("ko-KR")}원</span>
                </div>
                <div className="relative h-6">
                  <div className="absolute left-0 right-0 top-[11px] h-1 rounded-sm bg-[#E7E7EB]" />
                  <div
                    className="absolute top-[11px] h-1 rounded-sm bg-primary"
                    style={{
                      left: `${(priceMin / PRICE_MAX) * 100}%`,
                      right: `${100 - (priceMax / PRICE_MAX) * 100}%`,
                    }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={PRICE_MAX}
                    step={50000}
                    value={priceMin}
                    onChange={(e) => setPriceMin(Math.min(+e.target.value, priceMax))}
                    className="dual-range pointer-events-none absolute left-0 top-0 m-0 h-6 w-full appearance-none bg-transparent"
                  />
                  <input
                    type="range"
                    min={0}
                    max={PRICE_MAX}
                    step={50000}
                    value={priceMax}
                    onChange={(e) => setPriceMax(Math.max(+e.target.value, priceMin))}
                    className="dual-range pointer-events-none absolute left-0 top-0 m-0 h-6 w-full appearance-none bg-transparent"
                  />
                </div>
                <div className="mt-1.5 flex justify-between text-xs text-[#9A9AA2]">
                  <span>0원</span>
                  <span>3,000,000원</span>
                </div>
                <button
                  onClick={resetFilters}
                  className="mt-[22px] w-full rounded-[10px] border-[1.5px] border-[#DDDDE3] bg-white py-2.5 text-[13.5px] font-bold text-[#4B4B52] hover:border-primary hover:text-primary"
                >
                  필터 초기화
                </button>
              </div>
            )}

            {/* results grid */}
            <div>
              <div className="mb-4 flex items-center justify-between">
                <span className="text-[13.5px] text-[#8A8A92]">
                  <b className="text-ink">{loadState === "ready" ? cards.length : "-"}</b>개의 카드
                </span>
                <select className="cursor-pointer rounded-[9px] border border-[#DDDDE3] bg-white px-3 py-2 text-[13px] outline-none">
                  <option>인기순</option>
                  <option>가격 낮은순</option>
                  <option>가격 높은순</option>
                  <option>최신순</option>
                </select>
              </div>

              {loadState === "loading" && (
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[#EDEDF0] bg-white py-24">
                  <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#E7E7EB] border-t-primary" />
                  <span className="text-[13.5px] font-semibold text-[#8A8A92]">
                    카드 목록을 불러오는 중입니다...
                  </span>
                </div>
              )}

              {loadState === "error" && (
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[#EDEDF0] bg-white py-24">
                  <span className="text-[13.5px] font-bold text-[#D14343]">{errorMessage}</span>
                  <button
                    onClick={() => {
                      setLoadState("loading");
                      setReloadKey((k) => k + 1);
                    }}
                    className="mt-1 rounded-[9px] border-[1.5px] border-[#DDDDE3] bg-white px-4 py-2 text-[13px] font-bold text-[#4B4B52] hover:border-primary hover:text-primary"
                  >
                    다시 시도
                  </button>
                </div>
              )}

              {loadState === "ready" && cards.length === 0 && (
                <div className="flex items-center justify-center rounded-2xl border border-[#EDEDF0] bg-white py-24 text-[13.5px] text-[#8A8A92]">
                  조건에 맞는 카드가 없습니다.
                </div>
              )}

              {loadState === "ready" && cards.length > 0 && (
                <div className="grid grid-cols-5 gap-4">
                  {cards.map((c) => (
                    <Link
                      key={c.id}
                      href={`/cards/${c.id}`}
                      className="flex cursor-pointer flex-col overflow-hidden rounded-[13px] border border-[#EDEDF0] transition hover:-translate-y-[3px] hover:shadow-lift"
                    >
                      <div className="relative h-[180px] bg-[#F2F2F5]">
                        <CardImage src={c.imageUrl} alt={c.name} label="카드" />
                        <GradeBadge grade={c.grade} className="absolute left-[9px] top-[9px]" />
                      </div>
                      <div className="flex flex-1 flex-col p-3">
                        <div className="text-[13.5px] font-bold">{c.name}</div>
                        <div className="mt-0.5 text-[11.5px] text-[#9A9AA2]">{c.set}</div>
                        <div className="mt-auto pt-2.5 text-[15px] font-extrabold text-ink">
                          {c.price ?? (
                            <span className="text-[13px] font-semibold text-[#9A9AA2]">
                              가격 정보 준비중
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {!q && view === "dash" && (
          <div className="grid grid-cols-[60fr_40fr] items-start gap-[22px]">
            <div className="flex flex-col gap-5">
              <div className="rounded-2xl border border-t-[3px] border-[#EDEDF0] border-t-primary bg-white px-7 py-[26px]">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[13.5px] font-semibold text-[#8A8A92]">
                      리자몽 ex (S) 시세
                    </div>
                    <div className="mt-1.5 flex items-baseline gap-2.5">
                      <span className="text-[32px] font-extrabold tracking-[-1px]">₩142,000</span>
                      <span className="text-sm font-bold text-primary">▲ 3.2% (4,400)</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <span className="rounded-md bg-primary px-[11px] py-[5px] text-xs font-bold text-white">
                      7D
                    </span>
                    <span className="rounded-md bg-[#F2F2F5] px-[11px] py-[5px] text-xs font-bold text-[#8A8A92]">
                      1M
                    </span>
                    <span className="rounded-md bg-[#F2F2F5] px-[11px] py-[5px] text-xs font-bold text-[#8A8A92]">
                      1Y
                    </span>
                  </div>
                </div>
                <div className="mt-6 flex h-[170px] items-end gap-3">
                  {[48, 56, 44, 68].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t-[5px] bg-secondary"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                  {[62, 82, 100].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t-[5px] bg-primary"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
                <div className="mt-2.5 flex justify-between text-[11px] text-[#A8A8B0]">
                  {["7/16", "7/17", "7/18", "7/19", "7/20", "7/21", "오늘"].map((d) => (
                    <span key={d}>{d}</span>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-[#EDEDF0] bg-white px-7 py-6">
                <h2 className="mb-4 mt-0 text-base font-extrabold">최근 거래 내역</h2>
                <div className="grid grid-cols-4 border-b border-[#EDEDF0] pb-[11px] text-xs font-bold text-[#9A9AA2]">
                  <span>등급</span>
                  <span>체결가</span>
                  <span>변동</span>
                  <span className="text-right">시각</span>
                </div>
                {[
                  { g: "S" as Grade, p: "₩142,000", c: "▲ 3.2%", up: true, t: "2분 전" },
                  { g: "A" as Grade, p: "₩98,000", c: "▲ 1.1%", up: true, t: "18분 전" },
                  { g: "S" as Grade, p: "₩139,500", c: "▼ 0.7%", up: false, t: "1시간 전" },
                  { g: "B" as Grade, p: "₩61,000", c: "▲ 2.0%", up: true, t: "3시간 전" },
                ].map((r, i, a) => (
                  <div
                    key={i}
                    className={`grid grid-cols-4 items-center py-3 text-[13.5px] ${i < a.length - 1 ? "border-b border-[#F5F5F7]" : ""}`}
                  >
                    <span>
                      <GradeBadge grade={r.g} size="md" />
                    </span>
                    <span className="font-bold">{r.p}</span>
                    <span className={`font-bold ${r.up ? "text-primary" : "text-secondary"}`}>
                      {r.c}
                    </span>
                    <span className="text-right text-[#9A9AA2]">{r.t}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-5">
              <div className="rounded-2xl border border-[#EDEDF0] bg-white p-6">
                <div className="flex gap-4">
                  <div className="relative h-[132px] w-24 flex-shrink-0 overflow-hidden rounded-[10px] bg-[#F2F2F5]">
                    <CardImage />
                    <GradeBadge grade="S" size="sm" className="absolute left-[7px] top-[7px]" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[17px] font-extrabold">리자몽 ex</div>
                    <div className="mt-[3px] text-[12.5px] text-[#9A9AA2]">흑염의 지배자 · SAR</div>
                    <div className="mt-3.5 flex flex-col gap-[7px] text-[12.5px]">
                      {[
                        ["최고가", "₩158,000"],
                        ["최저가", "₩121,000"],
                        ["거래량(7D)", "342건"],
                      ].map(([k, v]) => (
                        <div key={k} className="flex justify-between">
                          <span className="text-[#8A8A92]">{k}</span>
                          <span className="font-bold">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <button className="mt-[18px] w-full rounded-[11px] border-2 border-primary-dark bg-primary py-3 text-[14.5px] font-bold text-white shadow-tactile-sm active:translate-y-0.5">
                  워치리스트에 추가
                </button>
              </div>
              <div className="rounded-2xl border border-[#EDEDF0] bg-white p-6">
                <h2 className="mb-3.5 mt-0 text-[15px] font-extrabold">추천 카드</h2>
                <div className="flex flex-col gap-3.5">
                  {[
                    { n: "뮤츠 ex", s: "레이징 서프 · SAR", p: "₩211,000", c: "▲ 1.1%", up: true },
                    { n: "뮤 UR", s: "151 · UR", p: "₩89,500", c: "▼ 1.4%", up: false },
                    {
                      n: "칠색조 ex",
                      s: "파라다임 트리거 · SAR",
                      p: "₩118,000",
                      c: "▲ 4.6%",
                      up: true,
                    },
                  ].map((r) => (
                    <div key={r.n} className="flex items-center gap-3">
                      <div className="h-14 w-10 flex-shrink-0 overflow-hidden rounded-[7px] bg-[#F2F2F5]">
                        <CardImage />
                      </div>
                      <div className="flex-1">
                        <div className="text-[13.5px] font-bold">{r.n}</div>
                        <div className="text-[11.5px] text-[#9A9AA2]">{r.s}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[13.5px] font-extrabold">{r.p}</div>
                        <div
                          className={`text-[11.5px] font-bold ${r.up ? "text-primary" : "text-secondary"}`}
                        >
                          {r.c}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
