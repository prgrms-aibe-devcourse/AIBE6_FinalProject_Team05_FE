export default function ChangeBadge({ amount, rate }: { amount: number; rate: number }) {
  if (amount === 0) return <span className="text-[#9A9AA2]">-</span>;
  const isRise = amount > 0;
  return (
    <span className={isRise ? "text-primary" : "text-secondary"}>
      {isRise ? "▲" : "▼"} {Math.abs(amount).toLocaleString("ko-KR")}원 ({Math.abs(rate).toFixed(2)}
      %)
    </span>
  );
}
