"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="main-content flex items-center justify-center bg-neutral px-10 py-14">
      <div className="w-full max-w-[420px] rounded-[18px] border border-[#EDEDF0] bg-white px-[34px] py-10 text-center shadow-card">
        <div className="mx-auto flex h-[64px] w-[64px] items-center justify-center rounded-full bg-[#FFF1F1]">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#EE1515"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
        </div>
        <h1 className="mt-4 text-[22px] font-extrabold tracking-[-0.5px]">문제가 발생했습니다</h1>
        <p className="mt-2.5 text-[14px] leading-relaxed text-[#7A7A82]">
          일시적인 오류로 페이지를 표시하지 못했습니다.
          <br />
          잠시 후 다시 시도해 주세요.
        </p>
        <button
          onClick={reset}
          className="mt-6 w-full rounded-[11px] border-2 border-primary-dark bg-primary py-3 text-[15px] font-bold text-white shadow-tactile"
        >
          다시 시도
        </button>
      </div>
    </main>
  );
}
