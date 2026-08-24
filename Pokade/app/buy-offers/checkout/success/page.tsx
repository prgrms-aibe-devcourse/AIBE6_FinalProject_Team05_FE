"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { confirmBuyOfferPayment } from "@/lib/buyOfferApi";
import { ApiError } from "@/lib/apiClient";

type ConfirmState = "confirming" | "success" | "error";

// useSearchParams는 정적 프리렌더 시 Suspense 경계를 요구함(next build에서 강제됨)
export default function BuyOfferCheckoutSuccessPage() {
  return (
    <Suspense>
      <BuyOfferCheckoutSuccessContent />
    </Suspense>
  );
}

// app/trades/checkout/success/page.tsx와 동일한 구조 - 구매입찰은 상세 상태 페이지가 없으므로
// 성공 시 카드 상세로 이동한다(cardId는 checkout 페이지가 쿼리로 넘겨준 값을 그대로 이어받는다).
function BuyOfferCheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<ConfirmState>("confirming");
  const [errorMessage, setErrorMessage] = useState("");
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

    confirmBuyOfferPayment(orderId, Number(amount), paymentKey)
      .then((buyOffer) => {
        // 완전한 새 페이지 로드로 이동 - trades/checkout/success와 동일한 이유(토스 리다이렉트
        // 직후 세션 복원 타이밍 문제를 피하기 위함).
        window.location.href = `/cards/${buyOffer.cardId}`;
      })
      .catch((err) => {
        setErrorMessage(err instanceof ApiError ? err.message : "구매입찰 등록에 실패했습니다.");
        setState("error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="main-content flex items-center justify-center bg-neutral px-10 py-14">
      <div className="w-full max-w-[420px] rounded-[18px] border border-[#EDEDF0] bg-white px-[34px] py-10 text-center shadow-card">
        {state === "confirming" && (
          <p className="text-[15px] font-semibold text-[#4B4B52]">결제를 확인하고 있습니다...</p>
        )}

        {state === "error" && (
          <>
            <p className="mb-2 text-[18px] font-extrabold text-primary">
              구매입찰 등록에 실패했습니다
            </p>
            <p className="mb-6 text-[13.5px] text-[#8A8A92]">{errorMessage}</p>
            <Link
              href="/mypage"
              className="inline-block w-full rounded-[11px] border-2 border-primary-dark bg-primary py-3 text-[14.5px] font-bold text-white shadow-tactile-sm"
            >
              마이페이지로 이동
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
