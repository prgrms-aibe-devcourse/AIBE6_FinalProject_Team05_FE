"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AddressSearchField from "@/components/AddressSearchField";
import CardImage from "@/components/CardImage";
import RequiredMark from "@/components/RequiredMark";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { ApiError } from "@/lib/apiClient";
import { cancelBuyOffer, fetchMyBuyOffer, updateBuyOfferRecipient } from "@/lib/buyOfferApi";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { GRADE_LABELS, GradeKey, MyBuyOfferResponse } from "@/types/price";

type LoadState = "loading" | "error" | "ready";

// 마이페이지 "입찰" 목록(구매입찰 탭)에서 항목을 클릭했을 때 보여주는 화면 - 카드 상세로 보내는
// 대신, 결제 전 마지막에 작성했던 주문서를 다시 보여준다. ACTIVE(아직 체결 전)일 때만 받는사람
// 정보를 수정할 수 있고, 결제는 이미 끝났으므로 제출 버튼 자리에 "결제 완료"만 표시한다.
export default function BuyOfferDetailPage() {
  const status = useRequireAuth();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const buyOfferId = Number(id);

  const [buyOffer, setBuyOffer] = useState<MyBuyOfferResponse | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [editingAddress, setEditingAddress] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !Number.isFinite(buyOfferId)) return;
    let cancelled = false;
    fetchMyBuyOffer(buyOfferId)
      .then((res) => {
        if (cancelled) return;
        setBuyOffer(res);
        setRecipientName(res.recipientName ?? "");
        setRecipientPhone(res.recipientPhone ?? "");
        setRecipientAddress(res.recipientAddress ?? "");
        setLoadState("ready");
      })
      .catch(() => {
        if (!cancelled) setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [status, buyOfferId]);

  if (status !== "authenticated") return null;

  if (!Number.isFinite(buyOfferId)) {
    return (
      <main className="main-content flex items-center justify-center bg-neutral px-10 py-14">
        <p className="text-[14px] font-semibold text-[#8A8A92]">잘못된 접근입니다.</p>
      </main>
    );
  }

  if (loadState === "loading") {
    return (
      <main className="main-content flex items-center justify-center bg-neutral px-10 py-14">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#E7E7EB] border-t-primary" />
      </main>
    );
  }

  if (loadState === "error" || !buyOffer) {
    return (
      <main className="main-content flex items-center justify-center bg-neutral px-10 py-14">
        <p className="text-[14px] font-semibold text-[#8A8A92]">주문서를 불러오지 못했습니다.</p>
      </main>
    );
  }

  const isEditable = buyOffer.status === "ACTIVE";
  const gradeKey: GradeKey = buyOffer.grade ?? "RAW";
  const shippingFee = buyOffer.shippingFee ?? 0;
  const pointsUsed = buyOffer.pointsUsed ?? 0;
  const finalAmount = buyOffer.price + shippingFee - pointsUsed;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!recipientName.trim() || !recipientPhone.trim() || !recipientAddress.trim()) {
      setError("모든 항목을 입력해 주세요.");
      return;
    }

    setSaving(true);
    try {
      await updateBuyOfferRecipient(buyOfferId, {
        recipientName: recipientName.trim(),
        recipientPhone: recipientPhone.trim(),
        recipientAddress: recipientAddress.trim(),
      });
      // 수정 완료 후엔 이 화면에 머물 이유가 없다 - 원래 있던 마이페이지(입찰 탭)로 바로 돌려보낸다.
      router.push("/mypage?bidTab=buyOffer");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "받는사람 정보 수정에 실패했습니다.");
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    setCancelError(null);
    try {
      const updated = await cancelBuyOffer(buyOfferId);
      setBuyOffer(updated);
      setConfirmingCancel(false);
    } catch (err) {
      setCancelError(err instanceof ApiError ? err.message : "결제 취소에 실패했습니다.");
    } finally {
      setCancelling(false);
    }
  };

  const inputCls =
    "w-full rounded-[11px] border border-[#DDDDE3] px-3.5 py-3 text-[14.5px] text-ink outline-none disabled:cursor-not-allowed disabled:bg-neutral disabled:text-[#9A9AA2]";
  const labelCls = "mb-[7px] block text-[13px] font-bold text-[#4B4B52]";
  const sectionCls = "rounded-[18px] border border-[#EDEDF0] bg-white px-[26px] py-7 shadow-card";
  const sectionTitleCls = "mb-4 text-[15px] font-extrabold";

  return (
    <main className="main-content bg-neutral px-10 pb-32 pt-14">
      <div className="mx-auto w-full max-w-[560px]">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-[20px] font-extrabold tracking-[-0.5px]">주문서</h1>
          <button
            type="button"
            onClick={() => router.back()}
            className="text-[13px] font-semibold text-[#8A8A92] hover:text-primary"
          >
            돌아가기
          </button>
        </div>

        <form id="buy-offer-detail-form" onSubmit={handleSave} className="space-y-6">
          {/* ① 구매 입찰 상품 */}
          <section className={sectionCls}>
            <h2 className={sectionTitleCls}>구매 입찰 상품</h2>
            <div className="flex items-center gap-3.5">
              <div className="relative h-28 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-[#F2F2F5]">
                <CardImage
                  src={buyOffer.cardImageUrl ?? undefined}
                  alt={buyOffer.cardNameKo ?? buyOffer.cardName ?? "카드"}
                  label="카드"
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-[14.5px] font-bold text-ink">
                  {buyOffer.cardNameKo ?? buyOffer.cardName ?? "알 수 없는 카드"}
                </p>
                <p className="text-[13px] font-bold text-ink">{GRADE_LABELS[gradeKey]}</p>
              </div>
            </div>
          </section>

          {/* ② 받는사람 정보 */}
          <section className={sectionCls}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] font-extrabold">받는사람 정보</h2>
              {!isEditable && (
                <span className="text-[12px] font-semibold text-[#9A9AA2]">
                  체결되어 수정할 수 없어요
                </span>
              )}
            </div>

            <label htmlFor="recipient-name" className={labelCls}>
              이름<RequiredMark />
            </label>
            <input
              id="recipient-name"
              type="text"
              value={recipientName}
              disabled={!isEditable}
              onChange={(e) => setRecipientName(e.target.value)}
              className={inputCls}
            />

            <div className="h-4" />

            <label htmlFor="recipient-phone" className={labelCls}>
              전화번호<RequiredMark />
            </label>
            <input
              id="recipient-phone"
              type="text"
              inputMode="numeric"
              value={recipientPhone}
              disabled={!isEditable}
              onChange={(e) => setRecipientPhone(formatPhoneNumber(e.target.value))}
              placeholder="010-0000-0000"
              className={inputCls}
            />

            <div className="h-4" />

            <label className={labelCls}>
              주소<RequiredMark />
            </label>
            {editingAddress ? (
              <AddressSearchField onChange={setRecipientAddress} inputCls={inputCls} />
            ) : (
              <div className="flex items-center gap-2">
                <input type="text" value={recipientAddress} disabled className={inputCls} />
                {isEditable && (
                  <button
                    type="button"
                    onClick={() => setEditingAddress(true)}
                    className="shrink-0 rounded-[11px] border border-[#DDDDE3] bg-white px-4 py-3 text-[13px] font-bold text-[#4B4B52] transition hover:border-primary hover:text-primary"
                  >
                    변경
                  </button>
                )}
              </div>
            )}
          </section>

          {/* ③ 최종 주문정보 */}
          <section className={sectionCls}>
            <h2 className={sectionTitleCls}>최종 주문정보</h2>
            <dl className="space-y-2.5">
              <div className="flex items-center justify-between">
                <dt className="text-[13px] font-semibold text-[#8A8A92]">입찰가</dt>
                <dd className="text-[14px] font-bold">{buyOffer.price.toLocaleString("ko-KR")}원</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[13px] font-semibold text-[#8A8A92]">배송비</dt>
                <dd className="text-[14px] font-bold">{shippingFee.toLocaleString("ko-KR")}원</dd>
              </div>
              {pointsUsed > 0 && (
                <div className="flex items-center justify-between">
                  <dt className="text-[13px] font-semibold text-[#8A8A92]">포인트 사용</dt>
                  <dd className="text-[14px] font-bold text-primary">
                    -{pointsUsed.toLocaleString("ko-KR")}원
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
              <p
                className={`pt-1 text-center text-[13px] font-extrabold ${
                  buyOffer.status === "CANCELLED" ? "text-[#9A9AA2]" : "text-[#059669]"
                }`}
              >
                {buyOffer.status === "CANCELLED" ? "결제 취소됨" : "결제 완료"}
              </p>
            </dl>
          </section>
        </form>
      </div>

      {isEditable && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-[#EDEDF0] bg-white px-10 py-4">
          <div className="mx-auto flex w-full max-w-[560px] flex-col gap-2.5">
            {error && <p className="text-[12.5px] font-semibold text-primary">{error}</p>}
            <button
              type="submit"
              form="buy-offer-detail-form"
              disabled={saving}
              className="w-full rounded-[11px] border-2 border-primary-dark bg-primary py-3.5 text-[15.5px] font-bold text-white shadow-tactile transition active:translate-y-0.5 active:shadow-tactile-active disabled:opacity-60"
            >
              {saving ? "저장 중..." : "수정 완료"}
            </button>

            {cancelError && <p className="text-[12.5px] font-semibold text-primary">{cancelError}</p>}
            {confirmingCancel ? (
              <div className="flex items-center gap-2 rounded-[11px] border-[1.5px] border-[#F6C6C6] bg-[#FFF1F1] px-4 py-3">
                <span className="flex-1 text-[13px] font-semibold text-[#C21414]">
                  정말 결제를 취소하시겠어요? 결제된 금액은 환불됩니다.
                </span>
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={handleCancel}
                  className="shrink-0 rounded-[9px] border-2 border-primary-dark bg-primary px-3 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-60"
                >
                  {cancelling ? "취소 중..." : "취소하기"}
                </button>
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={() => setConfirmingCancel(false)}
                  className="shrink-0 rounded-[9px] border border-[#DDDDE3] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#4B4B52]"
                >
                  돌아가기
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingCancel(true)}
                className="w-full rounded-[11px] border-[1.5px] border-[#DDDDE3] bg-white py-3 text-[14.5px] font-bold text-[#4B4B52] hover:border-primary hover:text-primary"
              >
                결제 취소
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
