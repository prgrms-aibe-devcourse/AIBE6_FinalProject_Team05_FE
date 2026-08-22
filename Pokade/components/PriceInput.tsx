"use client";

import { forwardRef } from "react";

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

  return (
    <div className="relative">
      <input
        ref={ref}
        id={id}
        type="text"
        inputMode="numeric"
        value={displayValue}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
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
