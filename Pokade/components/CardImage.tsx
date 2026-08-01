"use client";

import { useState } from "react";
import Image from "next/image";

// Renders real card art when `src` is given; falls back to a neutral
// placeholder when there's no src yet, or if the src fails to load.
export default function CardImage({
  src,
  alt,
  label,
  className = "",
  rounded = "",
}: {
  src?: string;
  alt?: string;
  label?: string;
  className?: string;
  rounded?: string;
}) {
  const [failed, setFailed] = useState(false);
  const resolvedAlt = alt ?? label ?? "카드 이미지";

  if (src && !failed) {
    return (
      <Image
        src={src}
        alt={resolvedAlt}
        fill
        sizes="(min-width: 768px) 25vw, 50vw"
        onError={() => setFailed(true)}
        className={`object-cover ${rounded} ${className}`}
      />
    );
  }

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
