import { CardPriceSummaryResponse } from "@/types/price";
import { toKrw } from "@/lib/currency";

// resolvePriceDisplay가 실제로 어떤 값을 근거로 가격을 골랐는지 — 검색 타일처럼 "이 숫자가
// 무슨 기준인지" 배지로 보여줘야 하는 화면이 label(문장형 문구)과 별도로 분기 처리할 때 쓴다.
export type PriceBasis = "sGrade" | "recentTrade" | "market";

// buyPrice(S등급 매물가) → recentTradePrice(S등급 최근 체결가) → marketPrice(card_prices 비등급 시세) 순으로
// 우선순위를 정한다. 앞의 둘은 우리 플랫폼에서 실제 거래된 카드에만 있어서, 거래 이력이 없는
// 대다수 카드는 marketPrice(Scrydex 동기화 참고 시세)까지 내려가야 값이 있다 — 셋 다 없으면 null.
// resolvePriceDisplay(카드 목록/상세의 가격 표시)와 resolveSortablePrice(검색 결과 가격순 정렬)가
// 같은 우선순위를 공유해야 "표시된 가격"과 "정렬 기준 가격"이 어긋나지 않으므로 여기서 한 번만 정한다.
function pickPrice(
  summary?: CardPriceSummaryResponse,
): { label: string; value: number; basis: PriceBasis } | null {
  if (summary?.buyPrice != null) {
    return { label: "S등급 상품가", value: summary.buyPrice, basis: "sGrade" };
  }
  if (summary?.recentTradePrice != null) {
    return { label: "최근 체결가", value: summary.recentTradePrice, basis: "recentTrade" };
  }
  if (summary?.marketPrice != null && summary.marketPriceCurrency != null) {
    const krw = toKrw(summary.marketPrice, summary.marketPriceCurrency);
    // 지원하지 않는 통화면 잘못된 환율로 추정치를 보여주는 대신 그냥 표시하지 않는다.
    if (krw != null) {
      return { label: "참고 시세", value: krw, basis: "market" };
    }
  }
  return null;
}

export function resolvePriceDisplay(
  summary?: CardPriceSummaryResponse,
): { label: string; price: string; basis: PriceBasis } | null {
  const picked = pickPrice(summary);
  if (!picked) return null;
  return {
    label: picked.label,
    price: `${picked.value.toLocaleString("ko-KR")}원`,
    basis: picked.basis,
  };
}

// 가격순 정렬 전용 — 화면에 보이는 가격(resolvePriceDisplay와 동일한 우선순위)을 숫자로 반환.
// 가격 정보가 아예 없는 카드는 null — 호출부에서 정렬 기준과 무관하게 항상 맨 뒤로 보낸다.
export function resolveSortablePrice(summary?: CardPriceSummaryResponse): number | null {
  return pickPrice(summary)?.value ?? null;
}

// 판매/구매입찰 등록·수정 화면의 "참고 시세" 배지 전용 - 등급별 매물가/구매입찰가(primaryField) →
// 그 등급 최근 체결가 → 마켓 참고가(marketPrice, KRW 환산) 순으로 내려간다. resolvePriceDisplay와
// 우선순위 개념은 같지만 primaryField를 buyPrice/sellPrice 중 호출부가 고를 수 있어야 하고
// (판매는 buyPrice=매물 최저가, 구매입찰은 sellPrice=구매입찰 최고가 기준), 라벨도 등급명을 넣어
// 호출부가 직접 구성하므로 값과 어느 단계에서 얻었는지(tier)만 반환한다.
export type ReferencePriceTier = "primary" | "recentTrade" | "market";

export function resolveGradeReferencePrice(
  summary: CardPriceSummaryResponse | null | undefined,
  primaryField: "buyPrice" | "sellPrice",
): { price: number; tier: ReferencePriceTier } | null {
  const primary = summary?.[primaryField];
  if (primary != null) {
    return { price: primary, tier: "primary" };
  }
  if (summary?.recentTradePrice != null) {
    return { price: summary.recentTradePrice, tier: "recentTrade" };
  }
  if (summary?.marketPrice != null && summary.marketPriceCurrency != null) {
    const krw = toKrw(summary.marketPrice, summary.marketPriceCurrency);
    // 지원하지 않는 통화면 잘못된 환율로 추정치를 보여주는 대신 그냥 표시하지 않는다.
    if (krw != null) {
      return { price: krw, tier: "market" };
    }
  }
  return null;
}
