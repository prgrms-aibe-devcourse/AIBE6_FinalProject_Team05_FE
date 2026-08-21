import { ReactNode } from "react";
import ChangeBadge from "@/components/portfolio/ChangeBadge";
import PokeballIcon from "@/components/portfolio/PokeballIcon";
import StatPill from "@/components/portfolio/StatPill";
import { PortfolioSummaryResponse } from "@/types/portfolio";

interface DexBannerProps {
  itemCount: number;
  totalPurchaseLabel: string;
  totalValueLabel: string;
  summary: PortfolioSummaryResponse | null;
  onAddClick: () => void;
  children: ReactNode;
}

// 도감 프레임 — 실물 포켓덱스 장치를 흉내낸 빨간 테두리 안에 "내 도감"/"도감 정보" 요약과
// children(카드 그리드 + 구성 비율)이 들어간다. 위/아래 빨간 바 사이를 포켓볼 엠블럼이 이어준다.
export default function DexBanner({
  itemCount,
  totalPurchaseLabel,
  totalValueLabel,
  summary,
  onAddClick,
  children,
}: DexBannerProps) {
  return (
    <div className="dex-shell rounded-[24px] p-4">
      <div>
        <div className="relative flex items-center justify-between gap-4 pb-4">
          <div className="flex items-center gap-2.5">
            <PokeballIcon className="h-7 w-7" />
            <h1 className="m-0 text-[20px] font-extrabold tracking-[0.5px] text-white">POKADE</h1>
          </div>
          <button
            type="button"
            onClick={onAddClick}
            className="flex items-center gap-1.5 rounded-full border-2 border-primary-dark bg-white px-5 py-2 text-[13.5px] font-extrabold text-primary-dark shadow-tactile-sm active:translate-y-0.5"
          >
            <PokeballIcon className="h-4 w-4" />
            카드 추가
          </button>

          <div className="pointer-events-none absolute left-1/2 top-full z-10 -translate-x-1/2 -translate-y-1/2">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-ink bg-white shadow-md">
              <PokeballIcon className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="rounded-[16px] bg-[#F4F4F8] px-5 py-6 sm:px-6">
          <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
            <div className="dex-screen rounded-lg px-6 py-5">
              <div className="flex items-center gap-2">
                <PokeballIcon className="h-4 w-4" />
                <h2 className="m-0 text-[15px] font-extrabold text-white">내 도감</h2>
              </div>
              <p className="mt-1 text-[12px] text-white/50">보유 카드 도감과 자산 현황을 확인하세요</p>
              <div className="mt-5 flex flex-wrap gap-10">
                <StatPill label="보유 카드" value={`${itemCount}종`} />
                <StatPill label="카드 구매가" value={totalPurchaseLabel} sub={`평가액 ${totalValueLabel}`} />
              </div>
            </div>

            <div className="rounded-lg border border-[#EDEDF0] bg-white px-6 py-5">
              <div className="flex items-center gap-2">
                <PokeballIcon className="h-4 w-4" />
                <h2 className="m-0 text-[13px] font-extrabold text-[#4B4B62]">도감 정보</h2>
              </div>
              <div className="mt-3 text-[13px] font-semibold text-[#8A8A92]">총 평가액</div>
              <div className="mt-1 text-[24px] font-extrabold tracking-[-0.5px]">{totalValueLabel}</div>
              <div className="mt-1.5 text-[12.5px] font-bold">
                <span className="mr-1.5 font-medium text-[#9A9AA2]">전일 대비</span>
                {summary && <ChangeBadge amount={summary.changeAmount} rate={summary.changeRate} />}
              </div>
            </div>
          </div>

          {children}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 px-2 pt-4">
        <div className="flex gap-[3px]">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="h-4 w-[3px] rounded-full bg-white/40" />
          ))}
        </div>
        <div className="text-[12px] font-extrabold tracking-[1px] text-white">NATIONAL POKADE</div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold tracking-[0.5px] text-white/80">GOTTA CATCH &apos;EM ALL!</span>
          <span className="h-2.5 w-2.5 rounded-full bg-[#3AD66B]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#FFCB05]" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/70" />
        </div>
      </div>
    </div>
  );
}
