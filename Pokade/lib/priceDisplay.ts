import { CardPriceSummaryResponse } from "@/types/price";
import { toKrw } from "@/lib/currency";

// buyPrice(S등급 매물가) → recentTradePrice(S등급 최근 체결가) → marketPrice(card_prices 비등급 시세) 순으로
// 표시한다. 앞의 둘은 우리 플랫폼에서 실제 거래된 카드에만 있어서, 거래 이력이 없는 대다수 카드는
// marketPrice(Scrydex 동기화 참고 시세)까지 내려가야 값이 있다 — 셋 다 없으면 null.
export function resolvePriceDisplay(
  summary?: CardPriceSummaryResponse,
): { label: string; price: string } | null {
  if (summary?.buyPrice != null) {
    return { label: "S등급 상품가", price: `${summary.buyPrice.toLocaleString("ko-KR")}원` };
  }
  if (summary?.recentTradePrice != null) {
    return { label: "최근 체결가", price: `${summary.recentTradePrice.toLocaleString("ko-KR")}원` };
  }
  if (summary?.marketPrice != null) {
    const krw = toKrw(summary.marketPrice, summary.marketPriceCurrency ?? "KRW");
    return { label: "참고 시세", price: `${krw.toLocaleString("ko-KR")}원` };
  }
  return null;
}
