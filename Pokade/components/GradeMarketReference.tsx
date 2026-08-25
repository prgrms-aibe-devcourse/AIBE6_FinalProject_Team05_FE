"use client";

import { useEffect, useState } from "react";
import { fetchActiveListings, fetchBuyOfferOrderbook, fetchPriceChart } from "@/lib/cardApi";
import { ListingGrade } from "@/types/price";

type LoadState = "loading" | "ready";
type PriceRow = { price: number; quantity: number };

const ROW_LIMIT = 5;

// 같은 가격끼리 묶어서 개수를 센다 — app/cards/[id]/OrderActivitySection.tsx의 groupByGradePrice와
// 같은 개념이지만, 여기서는 이미 등급 하나로 필터링된 가격 배열만 다루므로 등급은 신경 쓰지 않는다.
function groupByPrice(prices: number[]): PriceRow[] {
  const grouped = new Map<number, number>();
  for (const price of prices) {
    grouped.set(price, (grouped.get(price) ?? 0) + 1);
  }
  return Array.from(grouped.entries()).map(([price, quantity]) => ({ price, quantity }));
}

// 판매/구매입찰 등록 폼에서 "이 등급으로 얼마에 거래되고 있는지" 참고할 수 있도록, 선택된 등급의
// 최근 거래가와 현재 걸려있는 구매/판매입찰을 작게 보여주는 패널. 등급을 아직 안 골랐으면 아무것도
// 보여주지 않는다(비교 기준 자체가 없음).
export default function GradeMarketReference({
  cardId,
  variantId,
  grade,
}: {
  cardId: number;
  variantId?: number | null;
  grade: ListingGrade | "";
}) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [recentTradePrice, setRecentTradePrice] = useState<number | null>(null);
  const [buyRows, setBuyRows] = useState<PriceRow[]>([]);
  const [sellRows, setSellRows] = useState<PriceRow[]>([]);
  // 각 소스별 조회 실패를 "데이터 없음"과 구분해서 보여주기 위한 플래그 - 안 그러면 네트워크
  // 오류가 "최근 거래 내역이 없습니다."/"없음"으로 잘못 표시된다.
  const [tradesError, setTradesError] = useState(false);
  const [buyError, setBuyError] = useState(false);
  const [sellError, setSellError] = useState(false);

  useEffect(() => {
    if (!grade) return;
    let cancelled = false;
    // 등급을 바꿀 때마다 재조회 스피너를 다시 보여주기 위해 필요 — 비동기 페치 수명주기 표시라
    // 파생 상태로 대체할 수 없음(OrderActivitySection의 chartLoadState와 동일한 이유).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadState("loading");

    Promise.allSettled([
      fetchPriceChart(cardId, "180d"),
      fetchBuyOfferOrderbook(cardId, { variantId: variantId ?? undefined, grade }),
      fetchActiveListings(cardId),
    ]).then(([tradesResult, buyResult, sellResult]) => {
      if (cancelled) return;

      if (tradesResult.status === "fulfilled") {
        // fetchPriceChart는 오래된순이라 이 등급의 마지막 항목이 가장 최근 체결가.
        const matching = tradesResult.value.filter((t) => t.grade === grade);
        setRecentTradePrice(matching.length > 0 ? matching[matching.length - 1].price : null);
        setTradesError(false);
      } else {
        setRecentTradePrice(null);
        setTradesError(true);
      }

      if (buyResult.status === "fulfilled") {
        setBuyRows(
          groupByPrice(buyResult.value.map((o) => o.price)).sort((a, b) => b.price - a.price),
        );
        setBuyError(false);
      } else {
        setBuyRows([]);
        setBuyError(true);
      }

      if (sellResult.status === "fulfilled") {
        setSellRows(
          groupByPrice(
            sellResult.value.filter((l) => l.grade === grade).map((l) => l.price),
          ).sort((a, b) => a.price - b.price),
        );
        setSellError(false);
      } else {
        setSellRows([]);
        setSellError(true);
      }

      setLoadState("ready");
    });

    return () => {
      cancelled = true;
    };
  }, [cardId, variantId, grade]);

  if (!grade) return null;

  return (
    <div className="mt-1.5 rounded-[11px] border border-[#EDEDF0] bg-neutral p-3.5">
      <div className="mb-2.5 text-[12px] font-semibold text-[#8A8A92]">
        {loadState === "loading" ? (
          <span className="inline-block h-[14px] w-40 animate-pulse rounded bg-[#EDEDF0]" />
        ) : tradesError ? (
          "최근 거래가를 불러오지 못했습니다."
        ) : recentTradePrice != null ? (
          <>
            {grade} 등급 최근 거래가{" "}
            <span className="font-bold text-ink">{recentTradePrice.toLocaleString("ko-KR")}원</span>
          </>
        ) : (
          `${grade} 등급 최근 거래 내역이 없습니다.`
        )}
      </div>

      {loadState === "loading" && (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-[13px] w-12 animate-pulse rounded bg-[#EDEDF0]" />
              <div className="h-[13px] w-full animate-pulse rounded bg-[#EDEDF0]" />
              <div className="h-[13px] w-full animate-pulse rounded bg-[#EDEDF0]" />
            </div>
          ))}
        </div>
      )}

      {loadState === "ready" && (
        <div className="grid grid-cols-2 gap-3 text-[12px]">
          <div>
            <div className="mb-1 font-bold text-secondary">구매입찰</div>
            {buyError ? (
              <div className="text-primary">조회 실패</div>
            ) : buyRows.length === 0 ? (
              <div className="text-[#B4B4BB]">없음</div>
            ) : (
              buyRows.slice(0, ROW_LIMIT).map((row) => (
                <div key={row.price} className="flex justify-between tabular-nums text-[#4B4B52]">
                  <span>{row.price.toLocaleString("ko-KR")}원</span>
                  <span className="text-[#9A9AA2]">{row.quantity}개</span>
                </div>
              ))
            )}
          </div>
          <div>
            <div className="mb-1 font-bold text-primary">판매입찰</div>
            {sellError ? (
              <div className="text-primary">조회 실패</div>
            ) : sellRows.length === 0 ? (
              <div className="text-[#B4B4BB]">없음</div>
            ) : (
              sellRows.slice(0, ROW_LIMIT).map((row) => (
                <div key={row.price} className="flex justify-between tabular-nums text-[#4B4B52]">
                  <span>{row.price.toLocaleString("ko-KR")}원</span>
                  <span className="text-[#9A9AA2]">{row.quantity}개</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
