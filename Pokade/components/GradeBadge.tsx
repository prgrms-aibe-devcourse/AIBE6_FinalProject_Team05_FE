export type Grade = "S" | "A" | "B";

const SIZES = {
  sm: { text: "text-[9px]", padX: "px-[8px]", padY: "py-[2px]" },
  md: { text: "text-[11.5px]", padX: "px-[11px]", padY: "py-[3px]" },
  lg: { text: "text-[13px]", padX: "px-[13px]", padY: "py-[4px]" },
};

// 등급별 배경색 — cards/[id]/page.tsx의 매물/체결 등급 배지(ListingGradeBadge)에서도
// 동일한 톤으로 재사용한다. 테두리/텍스트색은 배지마다 형태가 달라(테두리 유무, B 텍스트색 등)
// 도메인별로 따로 두고, 실제로 겹치는 배경색 정의만 여기서 단일 소스로 공유한다.
export const GRADE_BG: Record<Grade, string> = {
  S: "bg-grade-s",
  A: "bg-grade-a",
  B: "bg-grade-b",
};

// 등급별 배경/테두리/텍스트 조합 — WCAG AA(4.5:1) 검증 완료.
const GRADE_STYLE: Record<Grade, string> = {
  S: `${GRADE_BG.S} border-[#C99A00] text-grade-s-ink`,
  A: `${GRADE_BG.A} border-[#28348F] text-white`,
  B: `${GRADE_BG.B} border-[#6B7280] text-[#1F2937]`,
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
        className={`inline-flex items-center justify-center rounded-full border-2 border-[#D5D7DC] bg-[#EEF0F2] shadow-sm ${s.text} ${s.padX} ${s.padY} font-bold leading-none tracking-[0.5px] text-[#5F6368] ${className}`}
      >
        등급 미정
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border-2 shadow-sm ${GRADE_STYLE[grade]} ${s.text} ${s.padX} ${s.padY} font-extrabold leading-none tracking-[0.5px] ${className}`}
    >
      {grade}
    </span>
  );
}
