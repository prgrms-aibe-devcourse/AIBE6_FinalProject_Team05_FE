"use client";

import { useEffect, useState } from "react";
import { VariantSummary, variantLabel } from "@/types/card";
import { PriceSummaryResponse } from "@/types/price";
import { fetchPriceSummary } from "@/lib/cardApi";

type LoadState = "loading" | "ready";

// 판본이 2개 이상인 카드만 의미가 있다(1개면 상단 즉시구매가 표시로 충분) — variants가
// 1개 이하면 조회도 하지 않고 아무것도 렌더링하지 않는다.
export default function VariantPriceComparison({
  cardId,
  variants,
}: {
  cardId: number;
  variants: VariantSummary[];
}) {
  const [variantPrices, setVariantPrices] = useState<Record<number, PriceSummaryResponse | null>>(
    {},
  );
  const [loadState, setLoadState] = useState<LoadState>("loading");

  useEffect(() => {
    if (variants.length <= 1) return;
    let cancelled = false;

    Promise.allSettled(variants.map((v) => fetchPriceSummary(cardId, v.id))).then((results) => {
      if (cancelled) return;
      const next: Record<number, PriceSummaryResponse | null> = {};
      variants.forEach((v, i) => {
        const r = results[i];
        next[v.id] = r.status === "fulfilled" ? r.value : null;
      });
      setVariantPrices(next);
      setLoadState("ready");
    });

    return () => {
      cancelled = true;
    };
  }, [cardId, variants]);

  if (variants.length <= 1) return null;

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-[#EDEDF0] bg-white p-5">
      <div className="mb-1 text-[12.5px] font-bold text-ink">판본별 시세 비교</div>
      {variants.map((v) => {
        const vp = variantPrices[v.id];
        return (
          <div
            key={v.id}
            className="flex items-center justify-between gap-4 rounded-xl bg-neutral px-3 py-2.5"
          >
            <span className="text-[12.5px] font-bold text-ink">{variantLabel(v.variantName)}</span>
            <div className="flex items-end gap-5">
              <div>
                <div className="text-[10.5px] font-semibold text-[#8A8A92]">즉시구매가</div>
                <div className="mt-0.5 text-right text-[15px] font-extrabold text-primary">
                  {loadState === "loading" ? (
                    <span className="text-[12.5px] font-semibold text-[#9A9AA2]">
                      불러오는 중...
                    </span>
                  ) : vp?.buyPrice != null ? (
                    `${vp.buyPrice.toLocaleString("ko-KR")}원`
                  ) : (
                    <span className="text-[12.5px] font-semibold text-[#9A9AA2]">상품 없음</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-[10.5px] font-semibold text-[#8A8A92]">판매가</div>
                <div className="mt-0.5 text-right text-[13px] font-bold text-ink">
                  {loadState === "loading" ? (
                    <span className="text-[12px] font-semibold text-[#9A9AA2]">불러오는 중...</span>
                  ) : vp?.sellPrice != null ? (
                    `${vp.sellPrice.toLocaleString("ko-KR")}원`
                  ) : (
                    <span className="text-[12px] font-semibold text-[#9A9AA2]">판매 요청 없음</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
