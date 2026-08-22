// "내 도감" 패널의 보유 카드 수/카드 구매가를 라벨+값 텍스트로 보여준다.
// sub은 value 아래 붙는 보조 정보(예: 평가액)로, 있을 때만 작은 글씨로 표시한다.
export default function StatPill({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-white/50">{label}</div>
      <div className="text-[15px] font-extrabold text-white">{value}</div>
      {sub && <div className="mt-0.5 text-[10px] font-medium text-white/40">{sub}</div>}
    </div>
  );
}
