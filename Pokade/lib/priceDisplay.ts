import { CardPriceSummaryResponse } from "@/types/price";
import { toKrw } from "@/lib/currency";

// buyPrice(S등급 매물가) → recentTradePrice(S등급 최근 체결가) → marketPrice(card_prices 비등급 시세) 순으로
// 우선순위를 정한다. 앞의 둘은 우리 플랫폼에서 실제 거래된 카드에만 있어서, 거래 이력이 없는
// 대다수 카드는 marketPrice(Scrydex 동기화 참고 시세)까지 내려가야 값이 있다 — 셋 다 없으면 null.
// resolvePriceDisplay(카드 목록/상세의 가격 표시)와 resolveSortablePrice(검색 결과 가격순 정렬)가
// 같은 우선순위를 공유해야 "표시된 가격"과 "정렬 기준 가격"이 어긋나지 않으므로 여기서 한 번만 정한다.
function pickPrice(
  summary?: CardPriceSummaryResponse,
): { label: string; value: number } | null {
  if (summary?.buyPrice != null) {
    return { label: "S등급 상품가", value: summary.buyPrice };
  }
  if (summary?.recentTradePrice != null) {
    return { label: "최근 체결가", value: summary.recentTradePrice };
  }
  if (summary?.marketPrice != null && summary.marketPriceCurrency != null) {
    const krw = toKrw(summary.marketPrice, summary.marketPriceCurrency);
    // 지원하지 않는 통화면 잘못된 환율로 추정치를 보여주는 대신 그냥 표시하지 않는다.
    if (krw != null) {
      return { label: "참고 시세", value: krw };
    }
  }
  return null;
}

export function resolvePriceDisplay(
  summary?: CardPriceSummaryResponse,
): { label: string; price: string } | null {
  const picked = pickPrice(summary);
  if (!picked) return null;
  return { label: picked.label, price: `${picked.value.toLocaleString("ko-KR")}원` };
}

// 가격순 정렬 전용 — 화면에 보이는 가격(resolvePriceDisplay와 동일한 우선순위)을 숫자로 반환.
// 가격 정보가 아예 없는 카드는 null — 호출부에서 정렬 기준과 무관하게 항상 맨 뒤로 보낸다.
export function resolveSortablePrice(summary?: CardPriceSummaryResponse): number | null {
  return pickPrice(summary)?.value ?? null;
}
