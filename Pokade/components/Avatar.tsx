"use client";

import { useState } from "react";
import { profileImageSrc } from "@/lib/profileImage";

interface AvatarProps {
  path: string | null; // BE가 준 서버 상대 경로 (이미지 없으면 null)
  nickname: string | null;
  size: number; // px
  className?: string; // 이니셜 원형의 배경,글자 스타일
}

// 프로필 이미지를 그리고, 없거나 불러오지 못하면 닉네임 이니셜 원형으로 되돌린다.
export default function Avatar({ path, nickname, size, className = "" }: AvatarProps) {
  const [failedPath, setFailedPath] = useState<string | null>(null);
  const src = path && path !== failedPath ? profileImageSrc(path) : null;

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- next/image는 remotePatterns 설정이 선행돼야 해서 일반 img를 쓴다
      <img
        src={src}
        alt={`${nickname ?? "사용자"} 프로필 이미지`}
        onError={() => setFailedPath(path)}
        style={{ width: size, height: size }}
        className="rounded-full object-cover"
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={`flex items-center justify-center rounded-full ${className}`}
    >
      {nickname?.charAt(0) ?? "U"}
    </div>
  );
}
