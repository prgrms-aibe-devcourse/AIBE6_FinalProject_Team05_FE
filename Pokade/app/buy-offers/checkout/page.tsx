"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { loadTossPayments, TossPaymentsWidgets } from "@tosspayments/tosspayments-sdk";
import CardImage from "@/components/CardImage";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useUserStore } from "@/store/useUserStore";

const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? "";

// useSearchParams는 정적 프리렌더 시 Suspense 경계를 요구함(next build에서 강제됨)
export default function BuyOfferCheckoutPage() {
  return (
    <Suspense>
      <BuyOfferCheckoutContent />
    </Suspense>
  );
}

// app/trades/checkout/page.tsx를 거의 그대로 미러링한 구매입찰 결제 화면 - successUrl/failUrl만
// /buy-offers/checkout/{success,fail}로 다르다.
function BuyOfferCheckoutContent() {
  const status = useRequireAuth();
  const userId = useUserStore((s) => s.userId);
  const searchParams = useSearchParams();

  const orderId = searchParams.get("orderId");
  const amount = Number(searchParams.get("amount"));
  const orderName = searchParams.get("orderName") ?? "구매입찰";
  const cardId = searchParams.get("cardId");
  const cardImage = searchParams.get("cardImage") ?? undefined;
  const grade = searchParams.get("grade");

  const [widgets, setWidgets] = useState<TossPaymentsWidgets | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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
        successUrl: `${window.location.origin}/buy-offers/checkout/success`,
        failUrl: `${window.location.origin}/buy-offers/checkout/fail`,
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "결제 요청 중 오류가 발생했습니다.");
      setRequesting(false);
    }
  };

  return (
    <main className="main-content bg-neutral px-10 py-12">
      <div className="mx-auto w-full max-w-[820px]">
        {cardId && (
          <Link
            href={`/cards/${cardId}`}
            className="mb-4 inline-block text-[13px] font-semibold text-[#8A8A92] hover:text-primary"
          >
            ← 카드 상세로
          </Link>
        )}

        <h1 className="m-0 mb-5 text-[22px] font-extrabold tracking-[-0.5px]">결제하기</h1>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr] lg:items-start">
          <div className="rounded-[18px] border border-[#EDEDF0] bg-white p-5 shadow-card">
            <p className="mb-3 text-[12.5px] font-bold text-[#9A9AA2]">구매 입찰 상품</p>

            <div className="relative aspect-[63/88] w-full overflow-hidden rounded-xl bg-[#F2F2F5]">
              <CardImage src={cardImage} alt={orderName} label="카드" />
            </div>

            <p className="mt-4 text-[15px] font-extrabold">{orderName}</p>

            <div className="my-4 h-px bg-[#EDEDF0]" />

            <dl className="space-y-2.5">
              {grade && (
                <div className="flex items-center justify-between">
                  <dt className="text-[13px] font-semibold text-[#8A8A92]">등급</dt>
                  <dd className="text-[14px] font-bold">{grade}</dd>
                </div>
              )}
              <div className="flex items-center justify-between">
                <dt className="text-[13px] font-semibold text-[#8A8A92]">결제 금액</dt>
                <dd className="text-[18px] font-extrabold text-primary">
                  {amount > 0 ? `${amount.toLocaleString("ko-KR")}원` : "-"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-[18px] border border-[#EDEDF0] bg-white p-7 shadow-card">
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
              {requesting
                ? "이동 중..."
                : !widgets
                  ? "결제 준비 중..."
                  : `${amount.toLocaleString("ko-KR")}원 결제하기`}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
