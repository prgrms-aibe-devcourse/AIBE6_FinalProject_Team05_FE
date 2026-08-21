interface PokeballIconProps {
  className?: string;
  // true면 빈 슬롯/차트 워터마크용 연한 단색 윤곽선, false(기본)면 로고/불릿용 빨강-흰색 아이콘.
  muted?: boolean;
}

// 포켓볼 아이콘 — 로고, "카드 추가" 버튼, 섹션 제목 불릿, 빈 슬롯 워터마크에 재사용한다.
export default function PokeballIcon({ className, muted }: PokeballIconProps) {
  if (muted) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.2" />
        <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2a10 10 0 0 1 10 10H2A10 10 0 0 1 12 2z" fill="#EE1515" />
      <path d="M2 12a10 10 0 0 0 20 0z" fill="#fff" />
      <circle cx="12" cy="12" r="10" fill="none" stroke="#1A1A1E" strokeWidth="1.4" />
      <line x1="2" y1="12" x2="22" y2="12" stroke="#1A1A1E" strokeWidth="1.4" />
      <circle cx="12" cy="12" r="3.2" fill="#fff" stroke="#1A1A1E" strokeWidth="1.4" />
    </svg>
  );
}
