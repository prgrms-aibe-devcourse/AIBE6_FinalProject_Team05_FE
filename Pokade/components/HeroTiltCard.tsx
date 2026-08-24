"use client";

import Image from "next/image";
import { useTilt } from "@/hooks/useTilt";

interface HeroTiltCardProps {
  src: string;
  alt: string;
  onClick: () => void;
}

// 마우스 위치에 따라 카드가 3D로 기울어지는 히어로 인터랙션 카드.
export default function HeroTiltCard({ src, alt, onClick }: HeroTiltCardProps) {
  const { glare, transform, transitionClass, handleMouseMove, handleMouseLeave } = useTilt({
    maxTiltDeg: 28,
    hoverScale: 1.1,
  });

  return (
    <div
      className="h-full w-full [perspective:600px]"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div
        onClick={onClick}
        role="button"
        aria-label="카드 크게 보기"
        className={`relative h-full w-full cursor-pointer rounded-[18px] ease-out will-change-transform ${transitionClass}`}
        style={{
          transform,
          transformStyle: "preserve-3d",
          transitionProperty: "transform",
        }}
      >
        <Image
          src={src}
          alt={alt}
          fill
          unoptimized
          sizes="330px"
          className="rounded-[18px] object-contain"
          priority
        />
        <div
          className="pointer-events-none absolute inset-0 rounded-[18px] transition-opacity duration-300"
          style={{
            opacity: glare.opacity,
            background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,0.85), transparent 55%)`,
            mixBlendMode: "overlay",
          }}
        />
      </div>
    </div>
  );
}
