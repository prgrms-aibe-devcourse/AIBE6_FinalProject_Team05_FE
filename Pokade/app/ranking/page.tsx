"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CardImage from "@/components/CardImage";
import MarketOverviewChart from "@/components/MarketOverviewChart";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { fetchMarketOverview, fetchPriceRanking, fetchPriceSummaries } from "@/lib/cardApi";
import { ApiError } from "@/lib/apiClient";
import {
  CardPriceSummaryResponse,
  MarketOverviewResponse,
  PriceRankingResponse,
  RankingType,
} from "@/types/price";

type LoadState = "loading" | "error" | "ready";

const TABS: { key: RankingType; label: string }[] = [
  { key: "rise", label: "급등 TOP 10" },
  { key: "fall", label: "급락 TOP 10" },
];

export default function RankingPage() {
  const authStatus = useRequireAuth();

  const [type, setType] = useState<RankingType>("rise");
  const [items, setItems] = useState<PriceRankingResponse[]>([]);
  // item.price는 등락률 계산에 쓰인 "최근 7일 S등급 평균 체결가"라 실제 지금 시점의 즉시구매가와
  // 다를 수 있다 - "현재 시세" 컬럼에는 이 배치 조회로 얻은 실제 현재가(buyPrice)를 보여준다.
  const [currentPrices, setCurrentPrices] = useState<Map<number, CardPriceSummaryResponse>>(new Map());
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // 거래 현황(시세 랭킹과 별개로 플랫폼 전체 거래량/거래가 중간값을 보여주는 개요) - rise/fall 탭 전환과
  // 무관한 데이터라 위 급등락 목록과는 별도의 effect/상태로 관리한다.
  const [overview, setOverview] = useState<MarketOverviewResponse | null>(null);
  const [overviewLoadState, setOverviewLoadState] = useState<LoadState>("loading");
  const [overviewReloadKey, setOverviewReloadKey] = useState(0);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    let cancelled = false;

    fetchPriceRanking(type)
      .then(async (res) => {
        if (cancelled) return;
        setItems(res);
        setLoadState("ready");
        // type 전환/재시도 시 이전 조회의 currentPrices가 남아있으면, 이번 배치 조회가 느리거나
        // 실패했을 때 엉뚱한(이전) 시점의 값을 보여줄 수 있어 먼저 비운다 — 그래야 아래 렌더의
        // item.price 폴백이 의도대로(값이 없으면 폴백) 동작한다.
        setCurrentPrices(new Map());
        // 실제 현재가 조회는 등락률 랭킹 자체와 독립된 정보라, 실패해도 랭킹 표시를 막지 않는다
        // (currentPrices가 비어있으면 아래 렌더에서 item.price로 자연히 폴백).
        try {
          const summaries = await fetchPriceSummaries(res.map((item) => item.cardId), { grade: "S" });
          if (!cancelled) setCurrentPrices(summaries);
        } catch {
          // 무시 - 폴백으로 처리됨
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMessage(err instanceof ApiError ? err.message : "랭킹을 불러오지 못했습니다.");
        setLoadState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [authStatus, type, reloadKey]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    let cancelled = false;

    fetchMarketOverview()
      .then((res) => {
        if (cancelled) return;
        setOverview(res);
        setOverviewLoadState("ready");
      })
      .catch(() => {
        if (!cancelled) setOverviewLoadState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [authStatus, overviewReloadKey]);

  // useRequireAuth가 비로그인 사용자를 /login으로 리다이렉트하는 동안 보여줄 자리표시자.
  if (authStatus !== "authenticated") {
    return (
      <main className="main-content flex items-center justify-center bg-neutral">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#E7E7EB] border-t-primary" />
      </main>
    );
  }

  return (
    <main className="main-content bg-neutral px-10 pb-14 pt-9">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-[22px]">
          <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.6px]">시세 랭킹</h1>
          <p className="mt-1.5 text-sm text-[#8A8A92]">
            플랫폼 전체 거래 현황과 최근 7일간 S등급 평균 체결가 등락률 기준 TOP 10
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
          {/* 왼쪽: 급등/급락 TOP 10 (컴팩트) */}
          <div className="overflow-hidden rounded-2xl border border-[#EDEDF0] bg-white">
            <div className="flex gap-1.5 border-b border-[#EDEDF0] p-3">
              {TABS.map((t) => {
                const active = type === t.key;
                const activeCls =
                  t.key === "rise"
                    ? "border-primary bg-[#FFF5F5] font-bold text-primary"
                    : "border-secondary bg-[#EEF3FF] font-bold text-secondary";
                return (
                  <button
                    key={t.key}
                    onClick={() => {
                      if (t.key === type) return;
                      setType(t.key);
                      setLoadState("loading");
                    }}
                    className={`flex-1 cursor-pointer rounded-[9px] border-[1.5px] px-2 py-1.5 text-[12.5px] ${
                      active ? activeCls : "border-[#E4E4E9] bg-white font-semibold text-[#7A7A82]"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {loadState === "loading" && (
              <div className="flex flex-col items-center justify-center gap-2.5 py-16">
                <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-[#E7E7EB] border-t-primary" />
              </div>
            )}

            {loadState === "error" && (
              <div className="flex flex-col items-center justify-center gap-2.5 px-4 py-16 text-center">
                <span className="text-[12.5px] font-bold text-[#D14343]">{errorMessage}</span>
                <button
                  onClick={() => {
                    setLoadState("loading");
                    setReloadKey((k) => k + 1);
                  }}
                  className="mt-1 rounded-[9px] border-[1.5px] border-[#DDDDE3] bg-white px-3 py-1.5 text-[12px] font-bold text-[#4B4B52] hover:border-primary hover:text-primary"
                >
                  다시 시도
                </button>
              </div>
            )}

            {loadState === "ready" && items.length === 0 && (
              <div className="px-4 py-16 text-center">
                <p className="text-[12.5px] leading-relaxed text-[#8A8A92]">
                  {type === "rise" ? "급등한 카드가 없어요" : "급락한 카드가 없어요"}
                </p>
              </div>
            )}

            {loadState === "ready" && items.length > 0 && (
              <ul>
                {items.map((item, i) => {
                  const isRise = item.changeRate >= 0;
                  const changeCls = isRise ? "text-primary" : "text-secondary";
                  // 배치 조회가 아직 안 왔거나 그 카드에 지금 활성 S등급 매물이 없으면(buyPrice null),
                  // 등락률 계산에 쓰인 최근 7일 평균가로 폴백한다 - 빈 칸보다는 근사치가 낫다.
                  const currentPrice = currentPrices.get(item.cardId)?.buyPrice ?? item.price;
                  return (
                    <li key={item.cardId} className={i < items.length - 1 ? "border-b border-[#F2F2F5]" : ""}>
                      <Link
                        href={`/cards/${item.cardId}`}
                        className="flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-[#FAFAFB]"
                      >
                        <div
                          className={`w-4 flex-shrink-0 text-[12.5px] font-extrabold ${
                            i < 3 ? "text-primary" : "text-[#9A9AA2]"
                          }`}
                        >
                          {i + 1}
                        </div>
                        <div className="relative h-10 w-7 flex-shrink-0 overflow-hidden rounded-[6px] bg-[#F2F2F5]">
                          <CardImage
                            src={item.imageUrl ?? undefined}
                            alt={item.cardNameKo ?? item.cardName ?? undefined}
                            label="카드"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12.5px] font-bold">
                            {item.cardNameKo ?? item.cardName ?? "이름 없는 카드"}
                          </div>
                          <div className="mt-0.5 text-[11.5px] font-semibold text-[#7A7A82]">
                            {currentPrice.toLocaleString("ko-KR")}원
                          </div>
                        </div>
                        <div className={`flex-shrink-0 text-[12px] font-bold ${changeCls}`}>
                          {isRise ? "▲" : "▼"} {Math.abs(item.changeRate).toFixed(2)}%
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* 오른쪽: 거래 현황(플랫폼 전체 거래량 + 거래가 중간값) */}
          <div>
            {overviewLoadState === "error" && (
              <div className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-[#EDEDF0] bg-white py-24">
                <span className="text-[13.5px] font-bold text-[#D14343]">
                  거래 현황을 불러오지 못했습니다.
                </span>
                <button
                  onClick={() => {
                    setOverviewLoadState("loading");
                    setOverviewReloadKey((k) => k + 1);
                  }}
                  className="mt-1 rounded-[9px] border-[1.5px] border-[#DDDDE3] bg-white px-4 py-2 text-[13px] font-bold text-[#4B4B52] hover:border-primary hover:text-primary"
                >
                  다시 시도
                </button>
              </div>
            )}

            {overviewLoadState !== "error" && (
              <MarketOverviewChart
                todayVolume={overview?.todayVolume ?? 0}
                volumeChangeRate={overview?.volumeChangeRate ?? null}
                volumeChangeAmount={overview?.volumeChangeAmount ?? 0}
                todayAvgPrice={overview?.todayAvgPrice ?? null}
                avgChangeRate1d={overview?.avgChangeRate1d ?? null}
                avgChangeAmount1d={overview?.avgChangeAmount1d ?? null}
                avgChangeRate7d={overview?.avgChangeRate7d ?? null}
                avgChangeRate30d={overview?.avgChangeRate30d ?? null}
                totalVolume={overview?.totalVolume ?? 0}
                dailyStats={overview?.dailyStats ?? []}
                loading={overviewLoadState === "loading"}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
