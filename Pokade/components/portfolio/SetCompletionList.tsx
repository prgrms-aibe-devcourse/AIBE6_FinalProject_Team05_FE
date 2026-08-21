import PokeballIcon from "@/components/portfolio/PokeballIcon";
import { PortfolioSetCompletionResponse } from "@/types/portfolio";

// 세트별 수집 완성도 — "구성 비율"(보유 카드가 세트별로 얼마나 나뉘어 있는지)과 달리,
// 각 세트를 얼마나 다 모았는지(보유한 서로 다른 카드 수 / 세트 전체 카드 수)를 보여준다.
export default function SetCompletionList({ items }: { items: PortfolioSetCompletionResponse[] }) {
  return (
    <div className="w-full rounded-lg border border-[#EDEDF0] bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <PokeballIcon className="h-4 w-4" />
        <h3 className="text-[14px] font-bold text-[#4B4B52]">세트 완성도</h3>
      </div>
      {items.length === 0 ? (
        <div className="flex h-[160px] flex-col items-center justify-center gap-2 text-[13px] text-[#9A9AA2]">
          <PokeballIcon muted className="h-16 w-16 text-[#E3E3EC]" />
          아직 계산할 세트 정보가 없어요
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {items.map((item) => (
            <div key={item.expansionId}>
              <div className="mb-1 flex items-center justify-between text-[12.5px]">
                <span className="font-bold text-[#4B4B52]">{item.setName}</span>
                <span className="font-semibold text-[#9A9AA2]">
                  {item.ownedCount}/{item.totalCount} · {item.completionRate.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#F0F0F5]">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(100, item.completionRate)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
