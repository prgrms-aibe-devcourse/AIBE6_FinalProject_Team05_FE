import Link from "next/link";

import { RankingItem } from "@/types/chat";

function formatPrice(price: number | null | undefined): string {
  if (price == null) return "-";
  return price.toLocaleString("ko-KR") + "원";
}

function formatChangeRate(rate: number | null | undefined): string {
  if (rate == null || rate === 0) return "0%";
  return (rate > 0 ? "+" : "") + rate.toFixed(1) + "%";
}

function formatChangeAmount(amount: number | null | undefined): string {
  if (amount == null || amount === 0) return "0원";
  return (amount > 0 ? "+" : "") + amount.toLocaleString("ko-KR") + "원";
}

function changeColor(value: number | null | undefined): string {
  if (value == null) return "text-[#4B4B55]";
  if (value > 0) return "text-[#E03131]"; // 급등 빨간색
  if (value < 0) return "text-[#1971C2]"; // 급락 파란색
  return "text-[#4B4B55]";
}

interface RankingListProps {
  items: RankingItem[];
  // 미니 위젯(compact)과 전체 채팅 페이지(default) 사이즈 구분
  size?: "compact" | "default";
}

export default function RankingList({ items, size = "default" }: RankingListProps) {
  const isCompact = size === "compact";

  return (
    <ul className="flex flex-col gap-0 overflow-hidden rounded-[inherit]">
      {items.map((item, idx) => (
        <li
          key={item.cardId ?? idx}
          className={`border-b border-[#F0F0F0] last:border-b-0`}
        >
          <Link
            href={`/cards/${item.cardId}`}
            className={`flex items-center justify-between hover:bg-[#FAFAFB] ${
              isCompact ? "px-3 py-2" : "px-4 py-2.5"
            }`}
          >
            {/* 순위 + 카드명 */}
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={`flex-shrink-0 font-extrabold tabular-nums ${
                  isCompact ? "w-4 text-[11px] text-[#9A9AA2]" : "w-5 text-[12px] text-[#9A9AA2]"
                }`}
              >
                {idx + 1}
              </span>
              <span
                className={`truncate font-semibold ${isCompact ? "text-[12px]" : "text-[13.5px]"}`}
              >
                {item.cardNameKo ?? item.cardName}
              </span>
            </div>

            {/* 가격 + 등락 */}
            <div className={`flex-shrink-0 text-right ${isCompact ? "text-[11px]" : "text-[12.5px]"}`}>
              <div className="font-semibold text-ink">{formatPrice(item.price)}</div>
              <div className={`font-bold ${changeColor(item.changeRate)}`}>
                {formatChangeRate(item.changeRate)}&nbsp;
                <span className="font-semibold">{formatChangeAmount(item.changeAmount)}</span>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
