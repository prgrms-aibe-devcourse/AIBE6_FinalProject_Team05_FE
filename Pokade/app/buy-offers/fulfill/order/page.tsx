"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AddressSearchField from "@/components/AddressSearchField";
import CardImage from "@/components/CardImage";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { fulfillBuyOffer } from "@/lib/buyOfferApi";
import { ApiError } from "@/lib/apiClient";
import { fetchCardDetail } from "@/lib/cardApi";
import { parseCardId } from "@/types/card";

interface CardContext {
  displayName: string;
  englishName: string;
  setName: string;
  printedNumber: string;
  imageUrl: string;
}

// useSearchParams는 정적 프리렌더 시 Suspense 경계를 요구함(next build에서 강제됨)
export default function BuyOfferFulfillOrderPage() {
  return (
    <Suspense fallback={null}>
      <BuyOfferFulfillOrderForm />
    </Suspense>
  );
}

// 카드 상세에서 "즉시판매"를 선택했을 때 이어지는 주문서 단계 - 이 구매입찰은 등록 시점에 이미
// 결제(토스 에스크로 또는 포인트)가 끝나 있으므로, 판매자에게는 정산계좌·반송주소만 받아
// fulfillBuyOffer를 호출한다(별도 결제 절차 없음 - /listings/new/order와 같은 성격).
// 레이아웃은 구매/판매 계열 주문서와 동일한 크림(KREAM) 스타일 세로 섹션 스택을 따른다.
function BuyOfferFulfillOrderForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = useRequireAuth();

  const buyOfferIdParam = searchParams.get("buyOfferId");
  const buyOfferId = buyOfferIdParam ? Number(buyOfferIdParam) : null;
  const cardId = parseCardId(searchParams.get("cardId") ?? "");
  const price = Number(searchParams.get("price"));
  const gradeLabel = searchParams.get("grade") ?? "미등급";
  const cardImageParam = searchParams.get("cardImage") ?? undefined;

  const [cardContext, setCardContext] = useState<CardContext | null>(null);

  const [settlementBankName, setSettlementBankName] = useState("");
  const [settlementAccountNumber, setSettlementAccountNumber] = useState("");
  const [settlementAccountHolder, setSettlementAccountHolder] = useState("");
  const [returnRecipientName, setReturnRecipientName] = useState("");
  const [returnRecipientPhone, setReturnRecipientPhone] = useState("");
  const [returnAddress, setReturnAddress] = useState("");

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
          imageUrl: cardImageParam || detail.imageMedium || detail.imageSmall,
        });
      })
      .catch(() => {
        if (!cancelled) setCardContext(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]);

  if (status !== "authenticated") return null;

  if (buyOfferId == null || cardId == null || !price || !Number.isFinite(price) || price <= 0) {
    return (
      <main className="main-content flex items-center justify-center bg-neutral px-10 py-14">
        <p className="text-[14px] font-semibold text-[#8A8A92]">잘못된 접근입니다.</p>
      </main>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (
      !settlementBankName.trim() ||
      !settlementAccountNumber.trim() ||
      !settlementAccountHolder.trim() ||
      !returnRecipientName.trim() ||
      !returnRecipientPhone.trim() ||
      !returnAddress.trim()
    ) {
      setError("모든 항목을 입력해 주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const trade = await fulfillBuyOffer(buyOfferId, {
        settlementBankName: settlementBankName.trim(),
        settlementAccountNumber: settlementAccountNumber.trim(),
        settlementAccountHolder: settlementAccountHolder.trim(),
        returnRecipientName: returnRecipientName.trim(),
        returnRecipientPhone: returnRecipientPhone.trim(),
        returnAddress: returnAddress.trim(),
      });
      router.push(`/trade-status/${trade.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "즉시판매 체결에 실패했습니다.");
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

        <form id="buy-offer-fulfill-order-form" onSubmit={handleSubmit} className="space-y-6">
          {/* ① 즉시판매 상품 */}
          <section className={sectionCls}>
            <h2 className={sectionTitleCls}>즉시판매 상품</h2>
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
                <p className="text-[13px] font-bold text-ink">{gradeLabel}</p>
              </div>
            </div>
          </section>

          {/* ② 판매 정산 계좌 */}
          <section className={sectionCls}>
            <h2 className={sectionTitleCls}>판매 정산 계좌</h2>

            <label htmlFor="bank-name" className={labelCls}>
              은행명
            </label>
            <input
              id="bank-name"
              type="text"
              value={settlementBankName}
              onChange={(e) => setSettlementBankName(e.target.value)}
              placeholder="예) 국민은행"
              className={inputCls}
            />

            <div className="h-4" />

            <label htmlFor="account-number" className={labelCls}>
              계좌번호
            </label>
            <input
              id="account-number"
              type="text"
              value={settlementAccountNumber}
              onChange={(e) => setSettlementAccountNumber(e.target.value)}
              placeholder="- 없이 숫자만 입력"
              className={inputCls}
            />

            <div className="h-4" />

            <label htmlFor="account-holder" className={labelCls}>
              예금주
            </label>
            <input
              id="account-holder"
              type="text"
              value={settlementAccountHolder}
              onChange={(e) => setSettlementAccountHolder(e.target.value)}
              placeholder="예금주 이름"
              className={inputCls}
            />
          </section>

          {/* ③ 반송 주소 */}
          <section className={sectionCls}>
            <h2 className={sectionTitleCls}>반송 주소</h2>
            <p className="mb-4 text-[12.5px] text-[#8A8A92]">
              검수 실패 등으로 매물이 반송될 경우 사용됩니다.
            </p>

            <label htmlFor="return-name" className={labelCls}>
              받는사람 이름
            </label>
            <input
              id="return-name"
              type="text"
              value={returnRecipientName}
              onChange={(e) => setReturnRecipientName(e.target.value)}
              className={inputCls}
            />

            <div className="h-4" />

            <label htmlFor="return-phone" className={labelCls}>
              전화번호
            </label>
            <input
              id="return-phone"
              type="text"
              value={returnRecipientPhone}
              onChange={(e) => setReturnRecipientPhone(e.target.value)}
              placeholder="010-0000-0000"
              className={inputCls}
            />

            <div className="h-4" />

            <label className={labelCls}>주소</label>
            <AddressSearchField onChange={setReturnAddress} inputCls={inputCls} />
          </section>

          {/* ④ 최종 주문정보 */}
          <section className={sectionCls}>
            <h2 className={sectionTitleCls}>최종 주문정보</h2>
            <dl className="space-y-2.5">
              <div className="flex items-center justify-between">
                <dt className="text-[13px] font-semibold text-[#8A8A92]">체결 가격</dt>
                <dd className="text-[14px] font-bold">{price.toLocaleString("ko-KR")}원</dd>
              </div>
              <div className="my-1 h-px bg-[#EDEDF0]" />
              <div className="flex items-center justify-between">
                <dt className="text-[14px] font-bold text-ink">정산금액</dt>
                <dd className="text-[18px] font-extrabold text-primary">
                  {price.toLocaleString("ko-KR")}원
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
            form="buy-offer-fulfill-order-form"
            disabled={submitting}
            className="w-full rounded-[11px] border-2 border-primary-dark bg-primary py-3.5 text-[15.5px] font-bold text-white shadow-tactile transition active:translate-y-0.5 active:shadow-tactile-active disabled:opacity-60"
          >
            {submitting ? "체결 중..." : `${price.toLocaleString("ko-KR")}원 · 즉시판매`}
          </button>
        </div>
      </div>
    </main>
  );
}
