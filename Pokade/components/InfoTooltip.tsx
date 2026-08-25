"use client";

import { useEffect, useRef, useState } from "react";

// hover/focus-within로만 여는 안내 툴팁은 iOS Safari 등 모바일 터치 환경에서 열리지 않는 경우가
// 많다 - 탭만으로는 focus-within이 발동하지 않기 때문. 클릭으로 열고 닫히게, 바깥을 클릭하면
// 자동으로 닫히게 만든 공용 안내 아이콘 컴포넌트.
export default function InfoTooltip({
  label,
  align = "center",
  iconClassName = "h-3.5 w-3.5 text-[9.5px]",
  children,
}: {
  label: string;
  align?: "left" | "center" | "right";
  iconClassName?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [open]);

  const positionCls =
    align === "left" ? "left-0" : align === "right" ? "right-0" : "left-1/2 -translate-x-1/2";

  return (
    <span ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex flex-shrink-0 items-center justify-center rounded-full bg-[#EDEDF0] font-bold text-[#8A8A92] ${iconClassName}`}
      >
        ?
      </button>
      {open && (
        <span
          className={`absolute bottom-full z-10 mb-2 w-64 whitespace-pre-line rounded-[10px] border border-[#EDEDF0] bg-white p-3 text-left text-[12px] leading-relaxed text-[#4B4B52] shadow-card ${positionCls}`}
        >
          {children}
        </span>
      )}
    </span>
  );
}
