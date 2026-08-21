"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState, useEffect } from "react";
import {
  BuyOfferOrderbookEntryResponse,
  GRADE_LABELS,
  GRADE_ORDER,
  GradeKey,
  ListingSummaryResponse,
  TradeSummaryResponse,
} from "@/types/price";
import { fetchActiveListings, fetchBuyOfferOrderbook, fetchPriceChart } from "@/lib/cardApi";
import { ApiError } from "@/lib/apiClient";
import { loginUrlFor } from "@/lib/authRedirect";

type LoadState = "loading" | "ready";
type Tab = "trades" | "buy" | "sell";

const TABS: { value: Tab; label: string }[] = [
  { value: "trades", label: "최근 체결" },
  { value: "buy", label: "구매입찰" },
  { value: "sell", label: "판매입찰" },
];

function formatTradedAt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

function gradeKeyOf(grade: string | null): GradeKey {
  return (grade ?? "RAW") as GradeKey;
}

// 크림(KREAM) 상품 상세의 "구매입찰/판매입찰" 탭을 참고 — 카드 상세에서 현재 그 매물에
// 걸려있는 입찰(매수/매도) 현황과 최근 체결 내역을 등급별/전체로 확인할 수 있게 한다.
// 세 데이터 모두 로그인이 필요한 API라(401 가능) 한 번에 조회해서 인증 여부를 공통으로 처리한다.
export default function OrderActivitySection({ cardId }: { cardId: number }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<Tab>("trades");
  const [gradeFilter, setGradeFilter] = useState<GradeKey | "ALL">("ALL");

  const [recentTrades, setRecentTrades] = useState<TradeSummaryResponse[]>([]);
  const [buyOffers, setBuyOffers] = useState<BuyOfferOrderbookEntryResponse[]>([]);
  const [sellListings, setSellListings] = useState<ListingSummaryResponse[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [authError, setAuthError] = useState<ApiError | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.allSettled([
      fetchPriceChart(cardId, "30d"),
      fetchBuyOfferOrderbook(cardId),
      fetchActiveListings(cardId),
    ]).then(([tradesResult, buyResult, sellResult]) => {
      if (cancelled) return;

      // 최근 체결 내역은 BE가 오래된순(차트용)으로 주므로, 여기서는 최신순으로 뒤집는다.
      setRecentTrades(tradesResult.status === "fulfilled" ? [...tradesResult.value].reverse() : []);
      setBuyOffers(buyResult.status === "fulfilled" ? buyResult.value : []);
      setSellListings(sellResult.status === "fulfilled" ? sellResult.value : []);

      // 셋 중 하나라도 401/403이면 "로그인 필요" 안내를 우선 보여준다 — 세 API 모두 동일한
      // 인증 요건이라 개별 실패보다 공통 원인(비로그인)일 가능성이 높다.
      const firstAuthFailure = [tradesResult, buyResult, sellResult].find(
        (r) => r.status === "rejected" && r.reason instanceof ApiError && (r.reason.status === 401 || r.reason.status === 403),
      );
      setAuthError(
        firstAuthFailure && firstAuthFailure.status === "rejected"
          ? (firstAuthFailure.reason as ApiError)
          : null,
      );
      setLoadState("ready");
    });

    return () => {
      cancelled = true;
    };
  }, [cardId]);

  const filteredTrades = useMemo(
    () => (gradeFilter === "ALL" ? recentTrades : recentTrades.filter((t) => gradeKeyOf(t.grade) === gradeFilter)),
    [recentTrades, gradeFilter],
  );
  const filteredBuyOffers = useMemo(
    () => (gradeFilter === "ALL" ? buyOffers : buyOffers.filter((o) => gradeKeyOf(o.grade) === gradeFilter)),
    [buyOffers, gradeFilter],
  );
  const filteredSellListings = useMemo(
    () => (gradeFilter === "ALL" ? sellListings : sellListings.filter((l) => gradeKeyOf(l.grade) === gradeFilter)),
    [sellListings, gradeFilter],
  );

  // 등급 필터 pill 옆에 각 등급의 건수를 보여주기 위해, 현재 탭 데이터 기준으로 집계한다.
  const gradeCounts = useMemo(() => {
    const source = tab === "trades" ? recentTrades : tab === "buy" ? buyOffers : sellListings;
    const counts = new Map<GradeKey, number>();
    for (const item of source) {
      const key = gradeKeyOf(item.grade);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [tab, recentTrades, buyOffers, sellListings]);

  const emptyMessage: Record<Tab, string> = {
    trades: "최근 30일간 체결 내역이 없습니다.",
    buy: "등록된 구매입찰이 없습니다.",
    sell: "등록된 판매입찰이 없습니다.",
  };

  return (
    <div className="rounded-2xl border border-[#EDEDF0] bg-white p-5">
      <div className="mb-4 flex gap-1.5 border-b border-[#F0F0F3] pb-3">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`rounded-[9px] px-3.5 py-1.5 text-[13px] font-bold transition ${
              tab === t.value
                ? "bg-primary text-white"
                : "text-[#8A8A92] hover:bg-neutral hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loadState === "loading" && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded-lg bg-[#F2F2F5]" />
          ))}
        </div>
      )}

      {loadState === "ready" && authError && (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-neutral py-10 text-center text-[13px] text-[#9A9AA2]">
          <span>입찰·체결 내역은 로그인 후 확인할 수 있습니다.</span>
          <Link
            href={loginUrlFor(pathname, searchParams)}
            className="text-[12.5px] font-bold text-primary hover:text-primary-dark"
          >
            로그인하기
          </Link>
        </div>
      )}

      {loadState === "ready" && !authError && (
        <>
          <div className="mb-4 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setGradeFilter("ALL")}
              className={`rounded-full border px-2.5 py-1 text-[11.5px] font-bold transition ${
                gradeFilter === "ALL"
                  ? "border-primary bg-lavender text-secondary"
                  : "border-[#DDDDE3] bg-white text-[#4B4B52] hover:border-primary hover:text-primary"
              }`}
            >
              전체
            </button>
            {GRADE_ORDER.filter((g) => (gradeCounts.get(g) ?? 0) > 0).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGradeFilter(g)}
                className={`rounded-full border px-2.5 py-1 text-[11.5px] font-bold transition ${
                  gradeFilter === g
                    ? "border-primary bg-lavender text-secondary"
                    : "border-[#DDDDE3] bg-white text-[#4B4B52] hover:border-primary hover:text-primary"
                }`}
              >
                {GRADE_LABELS[g]} {gradeCounts.get(g)}
              </button>
            ))}
          </div>

          {tab === "trades" &&
            (filteredTrades.length === 0 ? (
              <div className="rounded-xl bg-neutral py-10 text-center text-[13px] text-[#9A9AA2]">
                {emptyMessage.trades}
              </div>
            ) : (
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="text-[11.5px] font-semibold text-[#9A9AA2]">
                    <th className="pb-2 font-semibold">등급</th>
                    <th className="pb-2 font-semibold">거래가</th>
                    <th className="pb-2 text-right font-semibold">거래일</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrades.map((t, i) => (
                    <tr key={i} className="border-t border-[#F5F5F7]">
                      <td className="py-2 font-bold">{GRADE_LABELS[gradeKeyOf(t.grade)]}</td>
                      <td className="py-2 font-bold">{t.price.toLocaleString("ko-KR")}원</td>
                      <td className="py-2 text-right text-[#8A8A92]">{formatTradedAt(t.tradedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}

          {tab === "buy" &&
            (filteredBuyOffers.length === 0 ? (
              <div className="rounded-xl bg-neutral py-10 text-center text-[13px] text-[#9A9AA2]">
                {emptyMessage.buy}
              </div>
            ) : (
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="text-[11.5px] font-semibold text-[#9A9AA2]">
                    <th className="pb-2 font-semibold">등급</th>
                    <th className="pb-2 text-right font-semibold">입찰가</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBuyOffers.map((o) => (
                    <tr key={o.buyOfferId} className="border-t border-[#F5F5F7]">
                      <td className="py-2 font-bold">{GRADE_LABELS[gradeKeyOf(o.grade)]}</td>
                      <td className="py-2 text-right font-bold text-secondary">
                        {o.price.toLocaleString("ko-KR")}원
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}

          {tab === "sell" &&
            (filteredSellListings.length === 0 ? (
              <div className="rounded-xl bg-neutral py-10 text-center text-[13px] text-[#9A9AA2]">
                {emptyMessage.sell}
              </div>
            ) : (
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="text-[11.5px] font-semibold text-[#9A9AA2]">
                    <th className="pb-2 font-semibold">등급</th>
                    <th className="pb-2 text-right font-semibold">판매가</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSellListings.map((l) => (
                    <tr key={l.id} className="border-t border-[#F5F5F7]">
                      <td className="py-2 font-bold">{GRADE_LABELS[gradeKeyOf(l.grade)]}</td>
                      <td className="py-2 text-right font-bold text-primary">
                        {l.price.toLocaleString("ko-KR")}원
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
        </>
      )}
    </div>
  );
}
