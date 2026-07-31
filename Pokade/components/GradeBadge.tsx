export type Grade = "S" | "A" | "B";

// PSA/BGS 그레이딩 슬랩 스타일 — 등급별로 진하고 완전 불투명한 배경.
// 반투명 없이 어떤 카드 이미지 위에서도 동일한 톤으로 보이도록.
const STYLES: Record<Grade, string> = {
  S: "bg-[#B8860B] text-white", // 진한 금색(dark goldenrod)
  A: "bg-navy-700 text-white", // 진한 남색 — 기존 navy 토큰 재사용
  B: "bg-[#4B5563] text-white", // 진한 회색
};

const SIZES = {
  sm: "text-[9px] px-[7px] py-[3px]",
  md: "text-[11.5px] px-[10px] py-[5px]",
  lg: "text-[11px] px-[11px] py-[5px]",
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
  if (!grade) {
    return (
      <span
        className={`inline-block rounded-sm bg-[#EEF0F2] font-bold leading-none tracking-[0.5px] text-[#9A9AA2] ${SIZES[size]} ${className}`}
      >
        등급 미정
      </span>
    );
  }

  return (
    <span
      className={`inline-block rounded-sm font-extrabold leading-none tracking-[0.5px] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] ${STYLES[grade]} ${SIZES[size]} ${className}`}
    >
      {grade}
    </span>
  );
}

// Tailwind bg class per grade — handy for ConditionBar segments.
export const GRADE_BAR: Record<Grade, string> = {
  S: "bg-grade-s",
  A: "bg-grade-a",
  B: "bg-grade-b",
};
