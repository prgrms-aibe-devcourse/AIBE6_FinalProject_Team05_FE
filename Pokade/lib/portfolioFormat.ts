import { toKrw } from "@/lib/currency";

// currentMarketPrice/currency는 항목마다 다른 통화(Scrydex 원본 USD 등)로 올 수 있어
// 화면에는 항상 KRW로 환산해서 보여준다(priceDisplay.ts와 동일한 근사 환산 원칙).
export function formatKrw(price: number | null, currency: string | null): string {
  if (price == null || currency == null) return "정보 없음";
  const krw = toKrw(price, currency);
  return krw != null ? `${krw.toLocaleString("ko-KR")}원` : "정보 없음";
}
