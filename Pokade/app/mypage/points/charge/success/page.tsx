"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { confirmPointCharge } from "@/lib/pointApi";
import { ApiError } from "@/lib/apiClient";

type ConfirmState = "confirming" | "success" | "error";

// useSearchParams는 정적 프리렌더 시 Suspense 경계를 요구함(next build에서 강제됨)
export default function PointChargeSuccessPage() {
  return (
    <Suspense>
      <PointChargeSuccessContent />
    </Suspense>
  );
}

function PointChargeSuccessContent() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<ConfirmState>("confirming");
  const [balance, setBalance] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  // 개발 모드 StrictMode는 effect를 두 번 실행한다 - confirm은 BE에서 멱등 처리되지만(두 번째 호출은
  // 409), 그 사이 응답 순서에 따라 성공 상태가 에러로 덮어써질 수 있어 실제 호출 자체를 한 번으로 막는다.
  const requestedRef = useRef(false);

  useEffect(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;

    const paymentKey = searchParams.get("paymentKey");
    const orderId = searchParams.get("orderId");
    const amount = searchParams.get("amount");

    if (!paymentKey || !orderId || !amount) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setErrorMessage("결제 정보가 올바르지 않습니다.");
      setState("error");
      return;
    }

    confirmPointCharge(paymentKey, orderId, Number(amount))
      .then((res) => {
        setBalance(res.balance);
        setState("success");
      })
      .catch((err) => {
        setErrorMessage(err instanceof ApiError ? err.message : "포인트 충전 승인에 실패했습니다.");
        setState("error");
      });
    // 승인 콜백은 정확히 한 번만 호출되어야 한다 - searchParams 값 자체는 이 페이지가 살아있는 동안 바뀌지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="main-content flex items-center justify-center bg-neutral px-10 py-14">
      <div className="w-full max-w-[420px] rounded-[18px] border border-[#EDEDF0] bg-white px-[34px] py-10 text-center shadow-card">
        {state === "confirming" && (
          <p className="text-[15px] font-semibold text-[#4B4B52]">결제를 확인하고 있습니다...</p>
        )}

        {state === "success" && (
          <>
            <p className="mb-2 text-[18px] font-extrabold">충전이 완료되었습니다</p>
            {balance !== null && (
              <p className="mb-6 text-[14px] text-[#8A8A92]">
                현재 잔액 {balance.toLocaleString("ko-KR")} P
              </p>
            )}
            <Link
              href="/mypage"
              className="inline-block w-full rounded-[11px] border-2 border-primary-dark bg-primary py-3 text-[14.5px] font-bold text-white shadow-tactile-sm"
            >
              마이페이지로 이동
            </Link>
          </>
        )}

        {state === "error" && (
          <>
            <p className="mb-2 text-[18px] font-extrabold text-primary">충전에 실패했습니다</p>
            <p className="mb-6 text-[13.5px] text-[#8A8A92]">{errorMessage}</p>
            <Link
              href="/mypage/points/charge"
              className="inline-block w-full rounded-[11px] border-2 border-primary-dark bg-primary py-3 text-[14.5px] font-bold text-white shadow-tactile-sm"
            >
              다시 시도하기
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
