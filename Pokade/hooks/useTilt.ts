import { useState } from "react";

interface UseTiltOptions {
  maxTiltDeg?: number;
  hoverScale?: number;
}

// 마우스 위치를 따라가는 3D 카드 틸트 효과 — HeroTiltCard, ImageLightbox가 공유.
export function useTilt({ maxTiltDeg = 20, hoverScale = 1.05 }: UseTiltOptions = {}) {
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;

    setIsHovering(true);
    setRotate({
      x: (0.5 - py) * maxTiltDeg,
      y: (px - 0.5) * maxTiltDeg,
    });
    setGlare({ x: px * 100, y: py * 100, opacity: 0.5 });
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    setRotate({ x: 0, y: 0 });
    setGlare((g) => ({ ...g, opacity: 0 }));
  };

  const scale = isHovering ? hoverScale : 1;
  const transform = `rotateX(${rotate.x}deg) rotateY(${rotate.y}deg) scale3d(${scale}, ${scale}, ${scale})`;
  const transitionClass = isHovering ? "duration-75" : "duration-500";

  return { glare, isHovering, transform, transitionClass, handleMouseMove, handleMouseLeave };
}
