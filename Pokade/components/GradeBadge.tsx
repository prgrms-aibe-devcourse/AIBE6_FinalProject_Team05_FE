export type Grade = "S" | "A" | "B";

// Tailwind bg class per grade — 좌측 색상 블록과 ConditionBar 세그먼트가 공유.
export const GRADE_BAR: Record<Grade, string> = {
  S: "bg-grade-s",
  A: "bg-grade-a",
  B: "bg-grade-b",
};

const SIZES = {
  sm: { block: "w-[5px]", text: "text-[9px]", padX: "px-[6px]", padY: "py-[3px]" },
  md: { block: "w-[6px]", text: "text-[11.5px]", padX: "px-[9px]", padY: "py-[5px]" },
  lg: { block: "w-[7px]", text: "text-[11px]", padX: "px-[10px]", padY: "py-[5px]" },
};

// Grade 판정 기준 — /search 필터 사이드바의 등급 설명 툴팁 등에서 재사용.
export const GRADE_DESCRIPTIONS: Record<Grade, string> = {
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
  const s = SIZES[size];

  if (!grade) {
    return (
      <span
        className={`inline-flex items-stretch overflow-hidden rounded-sm border border-[#E1E3E8] bg-[#EEF0F2] ${className}`}
      >
        <span
          className={`${s.text} ${s.padX} ${s.padY} font-bold leading-none tracking-[0.5px] text-[#9A9AA2]`}
        >
          등급 미정
        </span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-stretch overflow-hidden rounded-sm border border-[#E1E3E8] bg-white ${className}`}
    >
      <span className={`${s.block} shrink-0 ${GRADE_BAR[grade]}`} aria-hidden="true" />
      <span
        className={`${s.text} ${s.padX} ${s.padY} font-extrabold leading-none tracking-[0.5px] text-ink`}
      >
        {grade}
      </span>
    </span>
  );
}
