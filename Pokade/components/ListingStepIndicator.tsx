// 상품 등록 2단계(상품정보 → 주문서) 진행 표시 - app/trade-status/[id]/page.tsx의 원형 아이콘 +
// 연결선 스텝 트래커와 동일한 패턴을 재사용한다. 두 화면이 별개 페이지라 폭/톤이 갑자기 바뀌는
// 느낌을 줄이기 위해 상단에 공통으로 붙인다.
const STEPS = ["상품정보", "주문서"] as const;

export default function ListingStepIndicator({ current }: { current: 1 | 2 }) {
  return (
    <div className="mb-6 flex items-center justify-center gap-2">
      {STEPS.map((label, i) => {
        const step = i + 1;
        const isDone = step < current;
        const isCurrent = step === current;
        return (
          <div key={label} className="flex items-center gap-2">
            {i > 0 && <div className={`h-[2px] w-8 ${isDone || isCurrent ? "bg-primary" : "bg-[#EDEDF0]"}`} />}
            <div className="flex items-center gap-1.5">
              <div
                className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  isDone
                    ? "bg-primary text-white"
                    : isCurrent
                      ? "border-2 border-primary bg-white text-primary"
                      : "border border-[#DDDDE3] bg-white text-[#B0B0B8]"
                }`}
              >
                {isDone ? "✓" : step}
              </div>
              <span
                className={`text-[12.5px] font-semibold ${isCurrent ? "text-ink" : isDone ? "text-[#4B4B52]" : "text-[#B0B0B8]"}`}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
