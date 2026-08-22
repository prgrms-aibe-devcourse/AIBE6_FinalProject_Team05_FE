import React from "react";

// 아이콘만 있는 버튼(하트 등)에 hover/포커스 시 뜨는 짧은 라벨. aria-label만 있으면
// 스크린리더 사용자만 무슨 버튼인지 알 수 있어서, 시각 사용자에게도 같은 정보를 준다(#235).
// 툴팁 자체는 aria-hidden — 감싸는 버튼의 aria-label이 이미 같은 문구를 읽어주므로
// 노출하면 같은 말이 두 번 읽힌다.
//
// hover는 터치 기기에 없다. 모바일에서는 하트를 눌렀을 때 뜨는 토스트("관심 등록했습니다 |
// 관심 목록 →")가 같은 학습을 담당하므로, 여기서 터치용 대체 트리거를 따로 만들지 않는다.
//
// placement: 타일처럼 overflow-hidden인 컨테이너 안에서는 잘리지 않는 쪽을 골라야 한다.
export default function IconTooltip({
  label,
  placement = "top",
  className = "",
  children,
}: {
  label: string;
  placement?: "top" | "bottom";
  className?: string;
  children: React.ReactNode;
}) {
  // 바깥 span에는 position을 두지 않는다 — 호출부가 className으로 absolute 배치를 넘기는
  // 경우(홈 타일의 하트)와 충돌하지 않도록, 툴팁의 기준점은 안쪽 relative span이 맡는다.
  return (
    <span className={`group inline-flex ${className}`}>
      <span className="relative inline-flex">
        {children}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-[8px] border border-[#EDEDF0] bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-[#4B4B52] opacity-0 shadow-card transition group-focus-within:opacity-100 group-hover:opacity-100 ${
            placement === "top" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          {label}
        </span>
      </span>
    </span>
  );
}
