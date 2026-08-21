"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CardImage from "@/components/CardImage";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { fetchPriceRanking, fetchPriceSummaries } from "@/lib/cardApi";
import { ApiError } from "@/lib/apiClient";
import { CardPriceSummaryResponse, PriceRankingResponse, RankingType } from "@/types/price";

type LoadState = "loading" | "error" | "ready";

const TABS: { key: RankingType; label: string }[] = [
  { key: "rise", label: "급등 TOP 10" },
  { key: "fall", label: "급락 TOP 10" },
];

const GRID_COLS = "grid-cols-[0.5fr_2.4fr_1.2fr_1fr_1.2fr]";

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

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    let cancelled = false;

    fetchPriceRanking(type)
      .then(async (res) => {
        if (cancelled) return;
        setItems(res);
        setLoadState("ready");
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
            최근 7일간 S등급 평균 체결가 등락률 기준 TOP 10
          </p>
        </div>

        <div className="mb-[18px] flex gap-2">
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
                className={`cursor-pointer rounded-[10px] border-[1.5px] px-[15px] py-2 text-[13.5px] ${
                  active ? activeCls : "border-[#E4E4E9] bg-white font-semibold text-[#7A7A82]"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {loadState === "loading" && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[#EDEDF0] bg-white py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#E7E7EB] border-t-primary" />
            <span className="text-[13.5px] font-semibold text-[#8A8A92]">
              랭킹을 불러오는 중입니다...
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

        {loadState === "ready" && items.length === 0 && (
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
                <path d="M4 19h16M7 19v-7M12 19V7M17 19v-4" />
              </svg>
            </div>
            <h3 className="mb-0 mt-[22px] text-lg font-extrabold">
              {type === "rise" ? "급등한 카드가 없어요" : "급락한 카드가 없어요"}
            </h3>
            <p className="mt-2.5 text-sm leading-relaxed text-[#8A8A92]">
              집계할 거래 데이터가 아직 충분하지 않습니다.
              <br />
              잠시 후 다시 확인해 주세요.
            </p>
          </div>
        )}

        {loadState === "ready" && items.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-[#EDEDF0] bg-white">
            <div
              className={`grid ${GRID_COLS} gap-4 border-b border-[#EDEDF0] bg-[#FAFAFB] px-[22px] py-3.5 text-xs font-bold text-[#9A9AA2]`}
            >
              <div>순위</div>
              <div>카드</div>
              <div>현재 시세</div>
              <div>변동률</div>
              <div>변동 금액</div>
            </div>
            {items.map((item, i) => {
              const isRise = item.changeRate >= 0;
              const changeCls = isRise ? "text-primary" : "text-secondary";
              // 배치 조회가 아직 안 왔거나 그 카드에 지금 활성 S등급 매물이 없으면(buyPrice null),
              // 등락률 계산에 쓰인 최근 7일 평균가로 폴백한다 - 빈 칸보다는 근사치가 낫다.
              const currentPrice = currentPrices.get(item.cardId)?.buyPrice ?? item.price;
              return (
                <Link
                  key={item.cardId}
                  href={`/cards/${item.cardId}`}
                  className={`grid ${GRID_COLS} items-center gap-4 px-[22px] py-4 hover:bg-[#FAFAFB] ${
                    i < items.length - 1 ? "border-b border-[#F2F2F5]" : ""
                  }`}
                >
                  <div
                    className={`text-sm font-extrabold ${i < 3 ? "text-primary" : "text-[#9A9AA2]"}`}
                  >
                    {i + 1}
                  </div>
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative h-14 w-10 flex-shrink-0 overflow-hidden rounded-[7px] bg-[#F2F2F5]">
                      <CardImage
                        src={item.imageUrl ?? undefined}
                        alt={item.cardName ?? undefined}
                        label="카드"
                      />
                    </div>
                    <div className="min-w-0 truncate text-sm font-bold">
                      {item.cardName ?? "이름 없는 카드"}
                    </div>
                  </div>
                  <div className="text-sm font-bold">{currentPrice.toLocaleString("ko-KR")}원</div>
                  <div className={`text-[13.5px] font-bold ${changeCls}`}>
                    {isRise ? "▲" : "▼"} {Math.abs(item.changeRate).toFixed(2)}%
                  </div>
                  <div className={`text-sm font-bold ${changeCls}`}>
                    {isRise ? "+" : "-"}
                    {Math.abs(item.changeAmount).toLocaleString("ko-KR")}원
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
