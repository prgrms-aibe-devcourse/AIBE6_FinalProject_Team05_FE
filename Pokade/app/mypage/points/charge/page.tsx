"use client";

import { ChangeEvent, useEffect, useState } from "react";
import Link from "next/link";
import { loadTossPayments, TossPaymentsWidgets } from "@tosspayments/tosspayments-sdk";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useUserStore } from "@/store/useUserStore";
import { readyPointCharge } from "@/lib/pointApi";
import { ApiError } from "@/lib/apiClient";

const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? "";
const ORDER_NAME = "포켓트레이드 포인트 충전";
const MIN_AMOUNT = 1000;
const MAX_AMOUNT = 1_000_000;
const QUICK_AMOUNTS = [1000, 5000, 10000, 30000, 50000, 100000];

type Step = "input" | "widget";

export default function PointChargePage() {
  const status = useRequireAuth();
  const userId = useUserStore((s) => s.userId);

  const [step, setStep] = useState<Step>("input");
  // 입력창은 문자열로 들고 있는다 - amount를 number 상태로 직접 바인딩하면 전부 지웠을 때
  // value가 0으로 즉시 되돌아가 빈 칸을 만들 수가 없다(그 앞에 숫자를 이어붙여야 하는 상황이 됨).
  const [amountInput, setAmountInput] = useState("10000");
  const amount = amountInput === "" ? 0 : Number(amountInput);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [widgets, setWidgets] = useState<TossPaymentsWidgets | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // #toss-payment-method/#toss-agreement는 step === "widget"일 때만 JSX에 렌더되므로,
  // 그 DOM이 실제로 커밋된 뒤(useEffect)에 위젯을 붙여야 한다 — handlePrepare 안에서 바로 부르면
  // setStep("widget") 이전이라 두 div가 아직 없어 렌더링이 조용히 실패한다.
  useEffect(() => {
    if (step !== "widget" || !widgets) return;
    widgets.renderPaymentMethods({ selector: "#toss-payment-method" });
    widgets.renderAgreement({ selector: "#toss-agreement" });
  }, [step, widgets]);

  if (status !== "authenticated" || userId === null) return null;

  const amountInRange = amount >= MIN_AMOUNT && amount <= MAX_AMOUNT;
  const amountIsStep = amount % 1000 === 0;
  const amountValid = amountInRange && amountIsStep;

  // 자동으로 반올림하지 않는다 - 1,000원 단위가 아니면 그 자리에서 진행을 막고 이유를 보여준다.
  const handleAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    setAmountInput(e.target.value.replace(/[^0-9]/g, ""));
  };

  const handlePrepare = async () => {
    if (!amountValid || preparing) return;
    setPreparing(true);
    setErrorMessage("");
    try {
      const ready = await readyPointCharge(amount);
      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY);
      // Toss customerKey는 2자 이상이어야 해서, 한 자리 userId(1~9)를 그대로 넘기면 위젯 생성이 실패한다.
      const widgetInstance = tossPayments.widgets({ customerKey: `user-${userId}` });
      await widgetInstance.setAmount({ currency: "KRW", value: ready.amount });

      setOrderId(ready.orderId);
      setWidgets(widgetInstance);
      setStep("widget");
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "결제 준비 중 오류가 발생했습니다.");
    } finally {
      setPreparing(false);
    }
  };

  const handleRequestPayment = async () => {
    if (!widgets || !orderId || requesting) return;
    setRequesting(true);
    setErrorMessage("");
    try {
      await widgets.requestPayment({
        orderId,
        orderName: ORDER_NAME,
        successUrl: `${window.location.origin}/mypage/points/charge/success`,
        failUrl: `${window.location.origin}/mypage/points/charge/fail`,
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
        <Link href="/mypage" className="mb-4 inline-block text-[13px] font-semibold text-[#8A8A92] hover:text-primary">
          ← 마이페이지
        </Link>

        <h1 className="m-0 mb-5 text-[22px] font-extrabold tracking-[-0.5px]">포인트 충전</h1>

        <div className="rounded-[18px] border border-[#EDEDF0] bg-white p-7 shadow-card">
          <label className="mb-2 block text-[13px] font-bold text-[#4B4B52]">충전 금액</label>
          <input
            type="text"
            inputMode="numeric"
            value={amountInput === "" ? "" : amount.toLocaleString("ko-KR")}
            disabled={step === "widget"}
            onChange={handleAmountChange}
            className="w-full rounded-[11px] border border-[#DDDDE3] px-3.5 py-3 text-[15px] font-bold text-ink outline-none focus:border-primary disabled:bg-[#FAFAFB] disabled:text-[#9A9AA2]"
          />
          {!amountValid && (
            <p className="mt-1.5 text-[12.5px] text-primary">
              {!amountInRange
                ? `${MIN_AMOUNT.toLocaleString("ko-KR")}원 이상 ${MAX_AMOUNT.toLocaleString("ko-KR")}원 이하로 입력해주세요.`
                : "1,000원 단위로 입력해주세요."}
            </p>
          )}

          {step === "input" && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {QUICK_AMOUNTS.map((quick) => (
                <button
                  key={quick}
                  type="button"
                  onClick={() => setAmountInput(String(quick))}
                  className="rounded-full border border-[#DDDDE3] bg-white px-3 py-1.5 text-[12px] font-bold text-[#4B4B52] transition hover:border-primary hover:text-primary"
                >
                  {quick.toLocaleString("ko-KR")}P
                </button>
              ))}
            </div>
          )}

          {errorMessage && (
            <p role="alert" className="mt-3 text-[12.5px] font-semibold text-primary">
              {errorMessage}
            </p>
          )}

          {step === "input" && (
            <button
              type="button"
              onClick={handlePrepare}
              disabled={!amountValid || preparing}
              className="mt-5 w-full rounded-[11px] border-2 border-primary-dark bg-primary py-3.5 text-[15px] font-bold text-white shadow-tactile transition active:translate-y-0.5 active:shadow-tactile-active disabled:opacity-60"
            >
              {preparing ? "준비 중..." : "결제 수단 선택하기"}
            </button>
          )}

          {step === "widget" && (
            <div className="mt-5">
              <div id="toss-payment-method" />
              <div id="toss-agreement" className="mt-3" />
              <button
                type="button"
                onClick={handleRequestPayment}
                disabled={requesting}
                className="mt-5 w-full rounded-[11px] border-2 border-primary-dark bg-primary py-3.5 text-[15px] font-bold text-white shadow-tactile transition active:translate-y-0.5 active:shadow-tactile-active disabled:opacity-60"
              >
                {requesting ? "이동 중..." : `${amount.toLocaleString("ko-KR")}원 결제하기`}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
