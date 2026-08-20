"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// useSearchParams는 정적 프리렌더 시 Suspense 경계를 요구함(next build에서 강제됨)
export default function TradeCheckoutFailPage() {
  return (
    <Suspense>
      <TradeCheckoutFailContent />
    </Suspense>
  );
}

function TradeCheckoutFailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const message = searchParams.get("message") ?? "결제가 완료되지 않았습니다.";

  return (
    <main className="main-content flex items-center justify-center bg-neutral px-10 py-14">
      <div className="w-full max-w-[420px] rounded-[18px] border border-[#EDEDF0] bg-white px-[34px] py-10 text-center shadow-card">
        <p className="mb-2 text-[18px] font-extrabold text-primary">결제가 취소되었습니다</p>
        <p className="mb-6 text-[13.5px] text-[#8A8A92]">{message}</p>
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-block w-full rounded-[11px] border-2 border-primary-dark bg-primary py-3 text-[14.5px] font-bold text-white shadow-tactile-sm"
        >
          다시 시도하기
        </button>
      </div>
    </main>
  );
}
