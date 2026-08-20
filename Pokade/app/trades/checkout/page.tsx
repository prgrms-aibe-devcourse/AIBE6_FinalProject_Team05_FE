"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { loadTossPayments, TossPaymentsWidgets } from "@tosspayments/tosspayments-sdk";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useUserStore } from "@/store/useUserStore";

const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? "";

// useSearchParams는 정적 프리렌더 시 Suspense 경계를 요구함(next build에서 강제됨)
export default function TradeCheckoutPage() {
  return (
    <Suspense>
      <TradeCheckoutContent />
    </Suspense>
  );
}

function TradeCheckoutContent() {
  const status = useRequireAuth();
  const userId = useUserStore((s) => s.userId);
  const searchParams = useSearchParams();

  const orderId = searchParams.get("orderId");
  const amount = Number(searchParams.get("amount"));
  const orderName = searchParams.get("orderName") ?? "카드 구매";
  const cardId = searchParams.get("cardId");

  const [widgets, setWidgets] = useState<TossPaymentsWidgets | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // /mypage/points/charge/page.tsx와 동일한 이유: #toss-payment-method/#toss-agreement는 위젯이
  // 준비된 뒤에야 렌더할 수 있으므로, DOM에 커밋된 뒤(useEffect)에 붙여야 한다.
  useEffect(() => {
    if (!widgets) return;
    widgets.renderPaymentMethods({ selector: "#toss-payment-method" });
    widgets.renderAgreement({ selector: "#toss-agreement" });
  }, [widgets]);

  useEffect(() => {
    if (status !== "authenticated" || userId === null) return;
    if (!orderId || !amount) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setErrorMessage("주문 정보가 올바르지 않습니다.");
      return;
    }

    let cancelled = false;
    loadTossPayments(TOSS_CLIENT_KEY)
      .then((tossPayments) => {
        if (cancelled) return;
        // Toss customerKey는 2자 이상이어야 해서, 한 자리 userId(1~9)를 그대로 넘기면 위젯 생성이 실패한다.
        const widgetInstance = tossPayments.widgets({ customerKey: `user-${userId}` });
        return widgetInstance.setAmount({ currency: "KRW", value: amount }).then(() => {
          if (cancelled) return;
          setWidgets(widgetInstance);
        });
      })
      .catch(() => {
        if (!cancelled) setErrorMessage("결제 준비 중 오류가 발생했습니다.");
      });

    return () => {
      cancelled = true;
    };
    // orderId/amount/userId는 이 페이지가 살아있는 동안 바뀌지 않는다 (쿼리 파라미터 기반).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, userId]);

  if (status !== "authenticated" || userId === null) return null;

  const handleRequestPayment = async () => {
    if (!widgets || !orderId || requesting) return;
    setRequesting(true);
    setErrorMessage("");
    try {
      await widgets.requestPayment({
        orderId,
        orderName,
        successUrl: `${window.location.origin}/trades/checkout/success`,
        failUrl: `${window.location.origin}/trades/checkout/fail`,
      });
      // 성공/실패 모두 successUrl·failUrl로 리다이렉트되므로 이 아래로는 보통 도달하지 않는다.
    } catch (err) {
      // 사용자가 결제창을 닫는 등 위젯 자체에서 던지는 에러(UserCancelError 등)는 리다이렉트 없이 여기로 온다.
      setErrorMessage(err instanceof Error ? err.message : "결제 요청 중 오류가 발생했습니다.");
      setRequesting(false);
    }
  };

  return (
    <main className="main-content bg-neutral px-10 py-12">
      <div className="mx-auto w-full max-w-[520px]">
        {cardId && (
          <Link
            href={`/cards/${cardId}`}
            className="mb-4 inline-block text-[13px] font-semibold text-[#8A8A92] hover:text-primary"
          >
            ← 카드 상세로
          </Link>
        )}

        <h1 className="m-0 mb-5 text-[22px] font-extrabold tracking-[-0.5px]">결제하기</h1>

        <div className="rounded-[18px] border border-[#EDEDF0] bg-white p-7 shadow-card">
          <p className="mb-1 text-[13px] font-bold text-[#4B4B52]">{orderName}</p>
          {amount > 0 && (
            <p className="mb-5 text-[20px] font-extrabold">{amount.toLocaleString("ko-KR")}원</p>
          )}

          <div id="toss-payment-method" />
          <div id="toss-agreement" className="mt-3" />

          {errorMessage && (
            <p role="alert" className="mt-3 text-[12.5px] font-semibold text-primary">
              {errorMessage}
            </p>
          )}

          <button
            type="button"
            onClick={handleRequestPayment}
            disabled={!widgets || requesting}
            className="mt-5 w-full rounded-[11px] border-2 border-primary-dark bg-primary py-3.5 text-[15px] font-bold text-white shadow-tactile transition active:translate-y-0.5 active:shadow-tactile-active disabled:opacity-60"
          >
            {requesting ? "이동 중..." : !widgets ? "결제 준비 중..." : `${amount.toLocaleString("ko-KR")}원 결제하기`}
          </button>
        </div>
      </div>
    </main>
  );
}
