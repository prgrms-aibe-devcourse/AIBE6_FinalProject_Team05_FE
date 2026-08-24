"use client";

import Image from "next/image";
import { useEscapeAndScrollLock } from "@/hooks/useEscapeAndScrollLock";
import { useTilt } from "@/hooks/useTilt";

interface ImageLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string | undefined;
  alt: string;
}

export default function ImageLightbox({ isOpen, onClose, imageSrc, alt }: ImageLightboxProps) {
  // 라이트박스 열림 중 ESC 닫기 + 배경 스크롤 방지 (/search 필터 드로어와 공용 훅).
  useEscapeAndScrollLock(isOpen, onClose);
  const { glare, transform, transitionClass, handleMouseMove, handleMouseLeave } = useTilt({
    maxTiltDeg: 18,
    hoverScale: 1.04,
  });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="카드 이미지 확대"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="닫기"
        className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[18px] font-bold text-ink hover:bg-white"
      >
        ×
      </button>
      {imageSrc && (
        <div
          className="[perspective:1000px]"
          onClick={(e) => e.stopPropagation()}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <div
            className={`relative ease-out will-change-transform ${transitionClass}`}
            style={{ transform, transformStyle: "preserve-3d", transitionProperty: "transform" }}
          >
            <Image
              src={imageSrc}
              alt={alt}
              width={500}
              height={700}
              unoptimized
              sizes="90vw"
              className="h-auto max-h-[90vh] w-auto max-w-[90vw] rounded-2xl object-contain shadow-[0_25px_60px_rgba(0,0,0,0.45)]"
            />
            <div
              className="pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-300"
              style={{
                opacity: glare.opacity,
                background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,0.85), transparent 55%)`,
                mixBlendMode: "overlay",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
