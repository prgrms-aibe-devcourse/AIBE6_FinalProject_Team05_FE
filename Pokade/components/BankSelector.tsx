"use client";

import { useState } from "react";
import { COMMON_BANKS } from "@/types/bank";

const CUSTOM_OPTION = "__custom__";

// 은행명을 자유 입력 대신 목록에서 고르게 한다 - 알약형 토글로 20여 개를 전부 펼치면 화면을
// 너무 많이 차지해서(#바로 다음 피드백), 인풋 한 줄만 차지하는 드롭다운으로 바꿨다.
// 목록에 없는 은행은 "직접 입력"으로 전환해 기존처럼 텍스트로 받는다.
export default function BankSelector({
  value,
  onChange,
  inputCls,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  inputCls: string;
  disabled?: boolean;
}) {
  const isPreset = COMMON_BANKS.includes(value);
  const [customMode, setCustomMode] = useState(value !== "" && !isPreset);

  return (
    <div>
      <select
        aria-label="은행명"
        value={customMode ? CUSTOM_OPTION : value}
        disabled={disabled}
        onChange={(e) => {
          if (e.target.value === CUSTOM_OPTION) {
            setCustomMode(true);
            onChange("");
            return;
          }
          setCustomMode(false);
          onChange(e.target.value);
        }}
        className={`${inputCls} appearance-none bg-white bg-[url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="%238A8A92" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>')] bg-[right_14px_center] bg-no-repeat pr-10`}
      >
        <option value="" disabled>
          은행을 선택해 주세요
        </option>
        {COMMON_BANKS.map((bank) => (
          <option key={bank} value={bank}>
            {bank}
          </option>
        ))}
        <option value={CUSTOM_OPTION}>직접 입력</option>
      </select>
      {customMode && (
        <input
          type="text"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          aria-label="은행명 직접 입력"
          placeholder="은행명을 입력해 주세요"
          autoFocus
          className={`${inputCls} mt-2.5`}
        />
      )}
    </div>
  );
}
