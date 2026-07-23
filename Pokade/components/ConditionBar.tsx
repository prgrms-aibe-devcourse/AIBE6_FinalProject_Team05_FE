// Lightly segmented condition / sub-score bar: ~10 soft-divided sections
// within a slim rounded bar (subtle game wink — never a bold HP bar).

const HEIGHTS = {
  sm: "h-[5px]",
  md: "h-[6px]",
  lg: "h-2",
};

export default function ConditionBar({
  filled,
  total = 10,
  color = "bg-secondary",
  empty = "bg-[#E7E7EB]",
  size = "md",
}: {
  filled: number;
  total?: number;
  color?: string;
  empty?: string;
  size?: keyof typeof HEIGHTS;
}) {
  const h = HEIGHTS[size];
  return (
    <div className="flex gap-[2px]">
      {Array.from({ length: total }).map((_, i) => {
        const on = i < filled;
        const round = i === 0 ? "rounded-l-[3px]" : i === total - 1 ? "rounded-r-[3px]" : "";
        return <span key={i} className={`flex-1 ${h} ${on ? color : empty} ${round}`} />;
      })}
    </div>
  );
}
