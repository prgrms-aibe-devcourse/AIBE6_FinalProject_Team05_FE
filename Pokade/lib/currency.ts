// card_prices는 카드에 따라 USD/JPY로 저장돼 있어 KRW 기준 화면에 그대로 못 섞는다.
// 실시간 환율 API가 없어 고정 근사치로 환산 — card_prices 자체가 아직 목업/추정 데이터인 시기라 근사치로 충분.
export const FX_TO_KRW: Record<string, number> = { KRW: 1, USD: 1400, JPY: 9 };

export function toKrw(price: number, currency: string): number {
  return Math.round(price * (FX_TO_KRW[currency] ?? 1));
}
