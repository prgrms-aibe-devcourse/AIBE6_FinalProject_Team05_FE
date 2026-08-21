import CardImage from "@/components/CardImage";
import PokeballIcon from "@/components/portfolio/PokeballIcon";
import { PortfolioItemResponse } from "@/types/portfolio";

interface PortfolioCardGridProps {
  items: PortfolioItemResponse[];
  onSelect: (item: PortfolioItemResponse) => void;
  onAddClick: () => void;
}

// 아직 등록 안 한 자리도 도감 슬롯 틀로 보이도록 채워두는 빈 칸 수. 스크롤 영역(아래 max-h)을
// 넘칠 만큼 넉넉하게 잡아서, 보이는 화면 안이 항상 그리드 틀로 꽉 차 있게 한다.
// 지금은 틀만 보여주는 용도라 클릭 동작은 없다.
const EMPTY_SLOT_COUNT = 30;

// 진짜 도감 앨범 페이지처럼 카드 사진만 촘촘하게 배치 — 이름/가격 등 텍스트는
// 슬롯을 탭했을 때 뜨는 PortfolioDetailModal에서만 보여준다. 슬롯 자체는 카드가
// 꽂혀 있는 오목한 트레이(dex-slot, app/globals.css)로, 카드가 그 위에 살짝 얹힌 것처럼 보이게 한다.
export default function PortfolioCardGrid({ items, onSelect, onAddClick }: PortfolioCardGridProps) {
  if (items.length === 0) {
    return (
      <div className="border border-dashed border-[#DADCF0] bg-lavender/40 px-10 py-16 text-center">
        <h3 className="mb-0 text-lg font-extrabold">아직 등록된 카드가 없어요</h3>
        <p className="mt-2.5 text-sm leading-relaxed text-[#8A8A92]">
          카드를 추가하면 도감이 채워지고, 자산 현황과 손익을 한눈에 볼 수 있어요.
        </p>
        <button
          type="button"
          onClick={onAddClick}
          className="mt-[26px] inline-block rounded border-2 border-primary-dark bg-primary px-[26px] py-3 text-[14.5px] font-bold text-white shadow-tactile-sm"
        >
          카드 추가
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PokeballIcon className="h-4 w-4" />
          <h2 className="text-[14px] font-extrabold text-[#4B4B62]">도감 리스트</h2>
        </div>
        <span className="text-[12.5px] font-semibold text-[#9A9AA2]">{items.length}종 등록됨</span>
      </div>
      {/* 카드가 늘어나도 이 패널만 정해진 높이 안에서 스크롤되고(도감 화면을 넘기는 느낌),
          바깥 레이아웃(사이드바 등)은 그대로 유지된다. */}
      <div className="chat-scroll max-h-[560px] overflow-y-auto pr-1">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {items.map((item, i) => {
            const displayName = item.cardName ?? "알 수 없는 카드";
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item)}
                aria-label={displayName}
                className="dex-slot group relative aspect-[5/7] overflow-hidden rounded p-[5px] transition hover:brightness-[1.03]"
              >
                <div className="relative h-full w-full overflow-hidden rounded-sm border border-black/5 transition group-hover:border-tertiary">
                  <CardImage src={item.cardImageSmall ?? undefined} alt={displayName} label="카드" />
                  <span className="absolute left-1 top-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[9px] font-bold text-white/90">
                    #{String(i + 1).padStart(3, "0")}
                  </span>
                  {item.quantity > 1 && (
                    <span className="absolute right-1 top-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      x{item.quantity}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
          {Array.from({ length: EMPTY_SLOT_COUNT }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="flex aspect-[5/7] items-center justify-center rounded border border-dashed border-[#DADCE6] bg-[#F7F7FB]"
            >
              <PokeballIcon muted className="h-8 w-8 text-[#E3E3EC]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
