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

export default function GradeBadge({
  grade,
  size = "md",
  className = "",
}: {
  grade: Grade;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      className={`inline-block rounded-full font-extrabold leading-none tracking-[0.5px] ${STYLES[grade]} ${SIZES[size]} ${className}`}
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
