import { CardPriceSummaryResponse } from "@/types/price";

// buyPrice(S등급 매물가) 우선, 없으면 recentTradePrice(S등급 최근 체결가)를 대신 보여준다 — 둘 다 없으면 null.
export function resolvePriceDisplay(
  summary?: CardPriceSummaryResponse,
): { label: string; price: string } | null {
  if (summary?.buyPrice != null) {
    return { label: "S등급 매물가", price: `${summary.buyPrice.toLocaleString("ko-KR")}원` };
  }
  if (summary?.recentTradePrice != null) {
    return { label: "최근 체결가", price: `${summary.recentTradePrice.toLocaleString("ko-KR")}원` };
  }
  return null;
}
