// card_prices는 카드에 따라 USD/JPY로 저장돼 있어 KRW 기준 화면에 그대로 못 섞는다.
// 실시간 환율 API가 없어 고정 근사치로 환산 — card_prices 자체가 아직 목업/추정 데이터인 시기라 근사치로 충분.
export type SupportedCurrency = "KRW" | "USD" | "JPY";

const FX_TO_KRW: Record<SupportedCurrency, number> = { KRW: 1, USD: 1400, JPY: 9 };

function isSupportedCurrency(currency: string): currency is SupportedCurrency {
  return currency in FX_TO_KRW;
}

// 지원하지 않는 통화면 null을 반환한다 — 환율 1배로 조용히 잘못된 값을 보여주지 않기 위함.
export function toKrw(price: number, currency: string): number | null {
  if (!isSupportedCurrency(currency)) return null;
  return Math.round(price * FX_TO_KRW[currency]);
}
