// Neutral image placeholder (stands in for real card art in the mockup).
export default function CardImage({
  label,
  className = "",
  rounded = "",
}: {
  label?: string;
  className?: string;
  rounded?: string;
}) {
  return (
    <div
      className={`flex h-full w-full items-center justify-center bg-[#F2F2F5] ${rounded} ${className}`}
    >
      {label ? (
        <span className="select-none text-[11px] font-medium text-[#B4B4BC]">{label}</span>
      ) : (
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#C7C7CE"
          strokeWidth="1.6"
        >
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <path d="M3 15l5-5 4 4 3-3 6 6" />
          <circle cx="9" cy="9" r="1.5" />
        </svg>
      )}
    </div>
  );
}
