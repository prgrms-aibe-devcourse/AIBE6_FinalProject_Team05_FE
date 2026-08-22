"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AddressSearchField from "@/components/AddressSearchField";
import CardImage from "@/components/CardImage";
import PriceInput from "@/components/PriceInput";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { ApiError } from "@/lib/apiClient";
import { getMyInfo } from "@/lib/authApi";
import { confirmBuyOfferPayment, readyBuyOffer } from "@/lib/buyOfferApi";
import { fetchCardDetail } from "@/lib/cardApi";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { parseCardId } from "@/types/card";
import { GRADE_LABELS, GradeKey, ListingGrade } from "@/types/price";

// 즉시구매(TradeService)의 고정 배송비와 동일한 값 - 각 도메인이 자기 화면에서 표시용으로 따로 갖는다
// (실제 최종 금액은 BE의 readyBuyOffer 응답이 기준이라, 여기 값이 어긋나도 결제 자체는 안전하다).
const SHIPPING_FEE = 3000;

interface CardContext {
  displayName: string;
  englishName: string;
  setName: string;
  printedNumber: string;
  imageUrl: string;
}

// useSearchParams는 정적 프리렌더 시 Suspense 경계를 요구함(next build에서 강제됨)
export default function NewBuyOfferOrderPage() {
  return (
    <Suspense fallback={null}>
      <NewBuyOfferOrderForm />
    </Suspense>
  );
}

// /buy-offers/new(카드/입찰가/등급 선택)를 마친 뒤 이어지는 주문서 단계 - 받는사람 정보와 결제 전
// 사용할 포인트를 입력받아 readyBuyOffer를 호출한다. 포인트로 전액을 충당하면(응답 amount === 0)
// 토스 결제 자체가 필요 없어 결제창 없이 바로 confirmBuyOfferPayment를 호출하고, 그렇지 않으면
// 남은 금액만큼 기존 /buy-offers/checkout(토스 위젯)으로 이동한다.
// 레이아웃은 app/listings/new/order와 동일한 크림(KREAM) 스타일 세로 섹션 스택을 따른다.
function NewBuyOfferOrderForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = useRequireAuth();

  const cardId = parseCardId(searchParams.get("cardId") ?? "");
  const variantIdParam = searchParams.get("variantId");
  const variantId = variantIdParam ? Number(variantIdParam) : undefined;
  const price = Number(searchParams.get("price"));
  const gradeParam = searchParams.get("grade");
  const grade = (gradeParam as ListingGrade | null) ?? undefined;
  const gradeKey: GradeKey = grade ?? "RAW";

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
          imageUrl: detail.imageMedium || detail.imageSmall,
        });
      })
      .catch(() => {
        if (!cancelled) setCardContext(null);
      });
    return () => {
      cancelled = true;
    };
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

  if (cardId == null || !price || !Number.isFinite(price) || price <= 0) {
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
  // 포인트 결제는 최소 단위가 1,000원 - mypage/points/charge와 동일한 정책.
  const pointsInputIsStep = Number(pointsToUseInput) % 1000 === 0;

  const handleUseAllPoints = () => {
    // 잔액/결제금액이 1,000원 단위가 아닐 수 있으므로, 전액 사용도 항상 유효한 값이 되도록 내림한다.
    const max = Math.min(pointBalance ?? 0, totalAmount);
    setPointsToUseInput(String(Math.floor(max / 1000) * 1000));
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
    if (!pointsInputIsStep) {
      setError("포인트는 1,000원 단위로 입력해주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const ready = await readyBuyOffer({
        cardId,
        variantId,
        price,
        grade,
        pointsToUse,
        recipientName: recipientName.trim(),
        recipientPhone: recipientPhone.trim(),
        recipientAddress: recipientAddress.trim(),
      });

      if (ready.amount <= 0) {
        // 포인트로 전액 충당 - 토스 결제창 없이 바로 승인 처리한다.
        const buyOffer = await confirmBuyOfferPayment(ready.orderId, ready.amount);
        router.push(`/cards/${buyOffer.cardId}`);
        return;
      }

      const orderName = cardContext ? `${cardContext.displayName} 구매입찰` : "구매입찰";
      const checkoutParams = new URLSearchParams({
        orderId: ready.orderId,
        amount: String(ready.amount),
        orderName,
        cardId: String(cardId),
      });
      if (cardContext?.imageUrl) checkoutParams.set("cardImage", cardContext.imageUrl);
      if (grade) checkoutParams.set("grade", GRADE_LABELS[grade]);
      router.push(`/buy-offers/checkout?${checkoutParams.toString()}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "구매입찰 등록에 실패했습니다.");
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

        <form id="buy-offer-order-form" onSubmit={handleSubmit} className="space-y-6">
          {/* ① 구매 입찰 상품 */}
          <section className={sectionCls}>
            <h2 className={sectionTitleCls}>구매 입찰 상품</h2>
            <div className="flex items-center gap-3.5">
              <div className="relative h-28 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-[#F2F2F5]">
                <CardImage
                  src={cardContext?.imageUrl}
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
                <p className="text-[13px] font-bold text-ink">{GRADE_LABELS[gradeKey]}</p>
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
              inputMode="numeric"
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(formatPhoneNumber(e.target.value))}
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
              <PriceInput
                id="points-to-use"
                value={pointsToUseInput}
                onChange={setPointsToUseInput}
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
            {(pointsInputExceedsBalance || pointsInputExceedsTotal || !pointsInputIsStep) && (
              <p className="mt-1.5 text-[12px] font-semibold text-primary">
                {pointsInputExceedsBalance
                  ? "보유 포인트보다 많이 사용할 수 없습니다."
                  : pointsInputExceedsTotal
                    ? "결제 금액보다 많은 포인트를 사용할 수 없습니다."
                    : "포인트는 1,000원 단위로 입력해주세요."}
              </p>
            )}
          </section>

          {/* ④ 최종 주문정보 */}
          <section className={sectionCls}>
            <h2 className={sectionTitleCls}>최종 주문정보</h2>
            <dl className="space-y-2.5">
              <div className="flex items-center justify-between">
                <dt className="text-[13px] font-semibold text-[#8A8A92]">입찰가</dt>
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
            form="buy-offer-order-form"
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
