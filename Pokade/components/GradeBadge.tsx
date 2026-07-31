export type Grade = "S" | "A" | "B";

// Clean solid-fill rounded pills — one subtle game-flavored touch.
// S = 가장 눈에 띄는 골드, A = 블루, B = 차분한 그레이.
const STYLES: Record<Grade, string> = {
  S: "bg-grade-s text-grade-s-ink",
  A: "bg-grade-a text-white",
  B: "bg-grade-b text-white",
};

const SIZES = {
  sm: "text-[9px] px-[7px] py-[3px]",
  md: "text-[10.5px] px-[9px] py-1",
  lg: "text-[11px] px-[11px] py-[5px]",
};

// Grade 판정 기준 — 등급 배지 옆 물음표 툴팁에 노출.
const GRADE_DESCRIPTIONS: Record<Grade, string> = {
  S: "최상급 상태 - 스크래치나 손상이 거의 없는 완벽한 상태",
  A: "우수한 상태 - 미세한 사용감은 있으나 전반적으로 양호한 상태",
  B: "양호한 상태 - 사용감이 있으나 게임/컬렉션에 적합한 상태",
};

export default function GradeBadge({
  grade,
  size = "md",
  className = "",
}: {
  grade?: Grade;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  if (!grade) {
    return (
      <span
        className={`inline-block rounded-full bg-[#EEF0F2] font-bold leading-none tracking-[0.5px] text-[#9A9AA2] ${SIZES[size]} ${className}`}
      >
        등급 미정
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-[3px] ${className}`}>
      <span
        className={`inline-block rounded-full font-extrabold leading-none tracking-[0.5px] ${STYLES[grade]} ${SIZES[size]}`}
      >
        {grade}
      </span>
      <span
        tabIndex={0}
        title={GRADE_DESCRIPTIONS[grade]}
        className="group relative inline-flex h-3.5 w-3.5 shrink-0 cursor-help items-center justify-center rounded-full bg-black/10 text-[8px] font-bold leading-none text-[#6B6B72] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#6B6B72]"
      >
        ?
        <span
          role="tooltip"
          className="pointer-events-none absolute left-0 top-[calc(100%+6px)] z-20 w-max max-w-[180px] rounded-md bg-[#1A1A1E] px-2.5 py-1.5 text-[11px] font-medium leading-snug text-white opacity-0 shadow-lift transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100"
        >
          {GRADE_DESCRIPTIONS[grade]}
        </span>
      </span>
    </span>
  );
}

// Tailwind bg class per grade — handy for ConditionBar segments.
export const GRADE_BAR: Record<Grade, string> = {
  S: "bg-grade-s",
  A: "bg-grade-a",
  B: "bg-grade-b",
};
