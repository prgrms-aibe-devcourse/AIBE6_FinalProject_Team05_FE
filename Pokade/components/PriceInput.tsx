"use client";

import { forwardRef, useCallback, useRef } from "react";

// 가격류 입력 공용 컴포넌트 - <input type="number">의 기본 위/아래 화살표(스피너) 대신, 값이 있을
// 때만 뜨는 x 버튼으로 즉시 비울 수 있게 한다. 표시값에는 1,000 단위 콤마를 넣는다(내부적으로는
// value를 항상 숫자만 남은 문자열로 들고 있는다 - "" 허용해야 전부 지운 빈 칸을 만들 수 있다,
// mypage/points/charge 페이지의 amountInput과 동일한 이유).
// forwardRef: AddWatchlistModal이 오픈 시 첫 입력 필드로 포커스를 옮기는 데 ref가 필요하다.
const PriceInput = forwardRef<
  HTMLInputElement,
  {
    id?: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className: string;
    disabled?: boolean;
  }
>(function PriceInput({ id, value, onChange, placeholder, className, disabled }, ref) {
  const displayValue = value === "" ? "" : Number(value).toLocaleString("ko-KR");

  // 커서를 되돌리려면 input 노드가 필요한데, 이 컴포넌트를 쓰는 곳 대부분은 ref를 넘기지 않는다.
  // 그래서 내부 ref를 따로 두고, 넘어온 ref에도 같은 노드를 전달한다(둘 다 만족시키는 콜백 ref).
  const innerRef = useRef<HTMLInputElement | null>(null);
  const setRefs = useCallback(
    (node: HTMLInputElement | null) => {
      innerRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  // 콤마 포맷 재계산으로 커서가 끝으로 리셋되는 것을 방지 — 길이 변화만큼 위치를 보정한다.
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const typed = e.target.value;
    const caret = e.target.selectionStart ?? typed.length;
    const raw = typed.replace(/[^0-9]/g, "");
    const nextDisplay = raw === "" ? "" : Number(raw).toLocaleString("ko-KR");
    // 기준은 방금 사용자가 만든 문자열(typed)이다 — selectionStart가 그 문자열 기준이라
    // 직전 표시값과 비교하면 어긋난다(예: "1,000"에 끝에서 0을 더하면 typed "1,0000"/next "10,000"로
    // 길이가 같아 보정이 0이어야 하는데, 직전값 "1,000" 기준으로는 +1이 되어 끝을 넘어간다).
    const pos = Math.max(
      0,
      Math.min(nextDisplay.length, caret + (nextDisplay.length - typed.length)),
    );

    onChange(raw);
    // 부모의 상태 반영으로 value가 다시 그려진 뒤에 옮겨야 한다.
    requestAnimationFrame(() => innerRef.current?.setSelectionRange(pos, pos));
  };

  return (
    <div className="relative">
      <input
        ref={setRefs}
        id={id}
        type="text"
        inputMode="numeric"
        value={displayValue}
        disabled={disabled}
        onChange={handleChange}
        placeholder={placeholder}
        className={`${className} ${value !== "" ? "pr-9" : ""}`}
      />
      {value !== "" && !disabled && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="입력값 지우기"
          className="absolute right-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-[#DDDDE3] text-[12px] font-bold leading-none text-white transition hover:bg-[#9A9AA2]"
        >
          ×
        </button>
      )}
    </div>
  );
});

export default PriceInput;
