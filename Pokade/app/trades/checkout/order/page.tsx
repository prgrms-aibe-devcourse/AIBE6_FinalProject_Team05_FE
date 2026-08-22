"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AddressSearchField from "@/components/AddressSearchField";
import CardImage from "@/components/CardImage";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { ApiError } from "@/lib/apiClient";
import { getMyInfo } from "@/lib/authApi";
import { fetchCardDetail } from "@/lib/cardApi";
import { confirmTradePurchase, readyTradePurchase } from "@/lib/tradeApi";
import { parseCardId } from "@/types/card";

// 즉시구매 결제 준비 시 BE(TradeService.ready())가 상품가에 더하는 고정 배송비와 동일한
// 표시용 값 - 각 화면이 자기 상수로 따로 갖는다(실제 최종 금액은 ready 응답이 기준).
const SHIPPING_FEE = 3000;

interface CardContext {
  displayName: string;
  englishName: string;
  setName: string;
  printedNumber: string;
  imageUrl: string;
}

// useSearchParams는 정적 프리렌더 시 Suspense 경계를 요구함(next build에서 강제됨)
export default function TradeCheckoutOrderPage() {
  return (
    <Suspense fallback={null}>
      <TradeCheckoutOrderForm />
    </Suspense>
  );
}

// 카드 상세의 등급 안내 모달 확인 이후 이어지는 즉시구매 주문서 단계 - 받는사람 정보와 결제 전
// 사용할 포인트를 입력받아 readyTradePurchase를 호출한다. 포인트로 전액을 충당하면(응답
// amount === 0) 토스 결제 자체가 필요 없어 결제창 없이 바로 confirmTradePurchase를 호출하고,
// 그렇지 않으면 남은 금액만큼 기존 /trades/checkout(토스 위젯)으로 이동한다.
// 레이아웃은 app/listings/new/order, app/buy-offers/new/order와 동일한 크림(KREAM) 스타일
// 세로 섹션 스택을 따른다(구매 계열 세 주문서의 UI를 통일).
function TradeCheckoutOrderForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = useRequireAuth();

  const listingIdParam = searchParams.get("listingId");
  const listingId = listingIdParam ? Number(listingIdParam) : null;
  const cardId = parseCardId(searchParams.get("cardId") ?? "");
  const price = Number(searchParams.get("price"));
  const gradeLabel = searchParams.get("grade");
  const cardImageParam = searchParams.get("cardImage") ?? undefined;

  const [cardContext, setCardContext] = useState<CardContext | null>(null);
  const [pointBalance, setPointBalance] = useState<number | null>(null);

  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [pointsToUseInput, setPointsToUseInput] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cardId == null) return;
    let cancelled = false;
    fetchCardDetail(cardId)
      .then((detail) => {
        if (cancelled) return;
        setCardContext({
          displayName: detail.nameKo ?? detail.name,
          englishName: detail.name,
          setName: detail.setName,
          printedNumber: detail.printedNumber,
          imageUrl: detail.imageMedium || detail.imageSmall || cardImageParam || "",
        });
      })
      .catch(() => {
        if (!cancelled) setCardContext(null);
      });
    return () => {
      cancelled = true;
    };
    // cardImageParam은 카드 상세 fetch 실패 시의 fallback일 뿐, 의존성으로 추적할 필요 없다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]);

  useEffect(() => {
    let cancelled = false;
    getMyInfo()
      .then((info) => {
        if (!cancelled) setPointBalance(info.pointBalance);
      })
      .catch(() => {
        if (!cancelled) setPointBalance(0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status !== "authenticated") return null;

  if (listingId == null || cardId == null || !price || !Number.isFinite(price) || price <= 0) {
    return (
      <main className="main-content flex items-center justify-center bg-neutral px-10 py-14">
        <p className="text-[14px] font-semibold text-[#8A8A92]">잘못된 접근입니다.</p>
      </main>
    );
  }

  const totalAmount = price + SHIPPING_FEE;
  const pointsToUse = Math.min(
    Number(pointsToUseInput) || 0,
    totalAmount,
    pointBalance ?? Number.POSITIVE_INFINITY,
  );
  const finalAmount = totalAmount - pointsToUse;

  const pointsInputExceedsBalance = pointBalance != null && Number(pointsToUseInput) > pointBalance;
  const pointsInputExceedsTotal = Number(pointsToUseInput) > totalAmount;

  const handleUseAllPoints = () => {
    setPointsToUseInput(String(Math.min(pointBalance ?? 0, totalAmount)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!recipientName.trim() || !recipientPhone.trim() || !recipientAddress.trim()) {
      setError("모든 항목을 입력해 주세요.");
      return;
    }
    if (pointsInputExceedsBalance) {
      setError("보유 포인트보다 많이 사용할 수 없습니다.");
      return;
    }
    if (pointsInputExceedsTotal) {
      setError("결제 금액보다 많은 포인트를 사용할 수 없습니다.");
      return;
    }

    setSubmitting(true);
    try {
      const ready = await readyTradePurchase(listingId, pointsToUse, {
        recipientName: recipientName.trim(),
        recipientPhone: recipientPhone.trim(),
        recipientAddress: recipientAddress.trim(),
      });

      if (ready.amount <= 0) {
        // 포인트로 전액 충당 - 토스 결제창 없이 바로 승인 처리한다.
        const trade = await confirmTradePurchase(ready.orderId, ready.amount);
        router.push(`/trade-status/${trade.id}`);
        return;
      }

      const checkoutParams = new URLSearchParams({
        orderId: ready.orderId,
        amount: String(ready.amount),
        orderName: cardContext?.displayName ?? "카드 구매",
        cardId: String(cardId),
      });
      if (cardContext?.imageUrl) checkoutParams.set("cardImage", cardContext.imageUrl);
      if (gradeLabel) checkoutParams.set("grade", gradeLabel);
      router.push(`/trades/checkout?${checkoutParams.toString()}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "구매 요청에 실패했습니다.");
      setSubmitting(false);
    }
  };

  const inputCls =
    "w-full rounded-[11px] border border-[#DDDDE3] px-3.5 py-3 text-[14.5px] text-ink outline-none";
  const labelCls = "mb-[7px] block text-[13px] font-bold text-[#4B4B52]";
  const sectionCls = "rounded-[18px] border border-[#EDEDF0] bg-white px-[26px] py-7 shadow-card";
  const sectionTitleCls = "mb-4 text-[15px] font-extrabold";

  return (
    <main className="main-content bg-neutral px-10 pb-32 pt-14">
      <div className="mx-auto w-full max-w-[560px]">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-[20px] font-extrabold tracking-[-0.5px]">주문서 작성</h1>
          <button
            type="button"
            onClick={() => router.back()}
            className="text-[13px] font-semibold text-[#8A8A92] hover:text-primary"
          >
            취소
          </button>
        </div>

        <form id="trade-order-form" onSubmit={handleSubmit} className="space-y-6">
          {/* ① 구매 상품 */}
          <section className={sectionCls}>
            <h2 className={sectionTitleCls}>구매 상품</h2>
            <div className="flex items-center gap-3.5">
              <div className="relative h-28 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-[#F2F2F5]">
                <CardImage
                  src={cardContext?.imageUrl || cardImageParam}
                  alt={cardContext?.displayName ?? "카드"}
                  label="카드"
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-[14.5px] font-bold text-ink">
                  {cardContext?.displayName ?? "-"}
                </p>
                {cardContext && (
                  <p className="truncate text-[12.5px] text-[#8A8A92]">{cardContext.englishName}</p>
                )}
                {cardContext && (
                  <p className="truncate text-[12px] text-[#8A8A92]">
                    {cardContext.setName} · No.{cardContext.printedNumber}
                  </p>
                )}
                {gradeLabel && <p className="text-[13px] font-bold text-ink">{gradeLabel}</p>}
              </div>
            </div>
          </section>

          {/* ② 받는사람 정보 */}
          <section className={sectionCls}>
            <h2 className={sectionTitleCls}>받는사람 정보</h2>

            <label htmlFor="recipient-name" className={labelCls}>
              이름
            </label>
            <input
              id="recipient-name"
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              className={inputCls}
            />

            <div className="h-4" />

            <label htmlFor="recipient-phone" className={labelCls}>
              전화번호
            </label>
            <input
              id="recipient-phone"
              type="text"
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
              placeholder="010-0000-0000"
              className={inputCls}
            />

            <div className="h-4" />

            <label className={labelCls}>주소</label>
            <AddressSearchField onChange={setRecipientAddress} inputCls={inputCls} />
          </section>

          {/* ③ 포인트 사용 */}
          <section className={sectionCls}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] font-extrabold">포인트 사용</h2>
              <p className="text-[12.5px] font-semibold text-[#8A8A92]">
                보유 {pointBalance != null ? pointBalance.toLocaleString("ko-KR") : "-"} P
              </p>
            </div>
            <div className="flex gap-2">
              <input
                id="points-to-use"
                type="number"
                min={0}
                max={Math.min(pointBalance ?? 0, totalAmount)}
                value={pointsToUseInput}
                onChange={(e) => setPointsToUseInput(e.target.value)}
                placeholder="0"
                className={inputCls}
              />
              <button
                type="button"
                onClick={handleUseAllPoints}
                className="flex-shrink-0 rounded-[11px] border border-[#DDDDE3] bg-white px-3.5 text-[13px] font-bold text-[#4B4B52] hover:border-primary hover:text-primary"
              >
                전액 사용
              </button>
            </div>
            {(pointsInputExceedsBalance || pointsInputExceedsTotal) && (
              <p className="mt-1.5 text-[12px] font-semibold text-primary">
                {pointsInputExceedsBalance
                  ? "보유 포인트보다 많이 사용할 수 없습니다."
                  : "결제 금액보다 많은 포인트를 사용할 수 없습니다."}
              </p>
            )}
          </section>

          {/* ④ 최종 주문정보 */}
          <section className={sectionCls}>
            <h2 className={sectionTitleCls}>최종 주문정보</h2>
            <dl className="space-y-2.5">
              <div className="flex items-center justify-between">
                <dt className="text-[13px] font-semibold text-[#8A8A92]">상품가</dt>
                <dd className="text-[14px] font-bold">{price.toLocaleString("ko-KR")}원</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[13px] font-semibold text-[#8A8A92]">배송비</dt>
                <dd className="text-[14px] font-bold">{SHIPPING_FEE.toLocaleString("ko-KR")}원</dd>
              </div>
              {pointsToUse > 0 && (
                <div className="flex items-center justify-between">
                  <dt className="text-[13px] font-semibold text-[#8A8A92]">포인트 사용</dt>
                  <dd className="text-[14px] font-bold text-primary">
                    -{pointsToUse.toLocaleString("ko-KR")}원
                  </dd>
                </div>
              )}
              <div className="my-1 h-px bg-[#EDEDF0]" />
              <div className="flex items-center justify-between">
                <dt className="text-[14px] font-bold text-ink">최종 결제 금액</dt>
                <dd className="text-[18px] font-extrabold text-primary">
                  {finalAmount.toLocaleString("ko-KR")}원
                </dd>
              </div>
            </dl>
          </section>
        </form>
      </div>

      {/* 하단 고정 제출 버튼 */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-[#EDEDF0] bg-white px-10 py-4">
        <div className="mx-auto w-full max-w-[560px]">
          {error && <p className="mb-2.5 text-[12.5px] font-semibold text-primary">{error}</p>}
          <button
            type="submit"
            form="trade-order-form"
            disabled={submitting}
            className="w-full rounded-[11px] border-2 border-primary-dark bg-primary py-3.5 text-[15.5px] font-bold text-white shadow-tactile transition active:translate-y-0.5 active:shadow-tactile-active disabled:opacity-60"
          >
            {submitting
              ? "처리 중..."
              : finalAmount > 0
                ? `${finalAmount.toLocaleString("ko-KR")}원 · 결제하러 가기`
                : "포인트로 결제 완료하기"}
          </button>
        </div>
      </div>
    </main>
  );
}
