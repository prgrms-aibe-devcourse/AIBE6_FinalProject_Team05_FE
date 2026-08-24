"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEscapeAndScrollLock } from "@/hooks/useEscapeAndScrollLock";
import { ApiError } from "@/lib/apiClient";
import { readyTradePurchase } from "@/lib/tradeApi";
import { useUserStore } from "@/store/useUserStore";
import { TradeReadyResponse } from "@/types/trade";

type BuyRecipientModalProps = {
  isOpen: boolean;
  listingId: number | null;
  onClose: () => void;
  onSuccess: (ready: TradeReadyResponse) => void;
  // ready() 실패(예: 그 사이 매물이 팔림) 시 부모가 목록/시세를 다시 불러올 수 있도록.
  onFailure?: () => void;
};

// 즉시구매 전 배송지(수령인 정보)와 사용할 포인트를 입력받는 모달 — BE의 TradeReadyRequest가
// recipientName/Phone/Address를 필수(@NotBlank)로 요구해서, 이 정보 없이는 ready() 자체가 불가능하다.
export default function BuyRecipientModal({
  isOpen,
  listingId,
  onClose,
  onSuccess,
  onFailure,
}: BuyRecipientModalProps) {
  const pointBalance = useUserStore((s) => s.pointBalance);

  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [pointsToUse, setPointsToUse] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const resetForm = useCallback(() => {
    setRecipientName("");
    setRecipientPhone("");
    setRecipientAddress("");
    setPointsToUse("");
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  useEscapeAndScrollLock(isOpen, handleClose);

  useEffect(() => {
    if (isOpen) nameInputRef.current?.focus();
  }, [isOpen]);

  const handleSubmit = async () => {
    if (listingId == null) return;
    if (!recipientName.trim() || !recipientPhone.trim() || !recipientAddress.trim()) {
      setError("수령인 정보를 모두 입력해 주세요.");
      return;
    }
    const points = pointsToUse.trim() ? Number(pointsToUse) : 0;
    if (!Number.isInteger(points) || points < 0) {
      setError("사용할 포인트를 올바르게 입력해 주세요.");
      return;
    }
    if (pointBalance != null && points > pointBalance) {
      setError("보유 포인트보다 많이 사용할 수 없습니다.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const ready = await readyTradePurchase({
        listingId,
        pointsToUse: points,
        recipientName: recipientName.trim(),
        recipientPhone: recipientPhone.trim(),
        recipientAddress: recipientAddress.trim(),
      });
      resetForm();
      onSuccess(ready);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "구매 요청에 실패했습니다.");
      onFailure?.();
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || listingId == null) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label="배송지 입력"
    >
      <div
        className="w-full max-w-[400px] rounded-2xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-[16px] font-extrabold">배송지 입력</h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="닫기"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[18px] font-bold text-[#9A9AA2] hover:bg-neutral"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-3.5">
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-[#4B4B52]">
            받는 사람
            <input
              ref={nameInputRef}
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="수령인 이름"
              className="rounded-[9px] border border-[#DDDDE3] px-3 py-2 text-[13.5px] outline-none focus:border-primary"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-[#4B4B52]">
            연락처
            <input
              type="tel"
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
              placeholder="010-0000-0000"
              className="rounded-[9px] border border-[#DDDDE3] px-3 py-2 text-[13.5px] outline-none focus:border-primary"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-[#4B4B52]">
            배송 주소
            <input
              type="text"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              placeholder="배송받을 주소를 입력해 주세요"
              className="rounded-[9px] border border-[#DDDDE3] px-3 py-2 text-[13.5px] outline-none focus:border-primary"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-[#4B4B52]">
            사용할 포인트
            {pointBalance != null && (
              <span className="text-[12px] font-semibold text-[#8A8A92]">
                보유 {pointBalance.toLocaleString("ko-KR")}P
              </span>
            )}
            <div className="flex gap-1.5">
              <input
                type="number"
                min={0}
                max={pointBalance ?? undefined}
                value={pointsToUse}
                onChange={(e) => setPointsToUse(e.target.value)}
                placeholder="0"
                className="flex-1 rounded-[9px] border border-[#DDDDE3] px-3 py-2 text-[13.5px] outline-none focus:border-primary"
              />
              {pointBalance != null && pointBalance > 0 && (
                <button
                  type="button"
                  onClick={() => setPointsToUse(String(pointBalance))}
                  className="flex-shrink-0 rounded-[9px] border border-[#DDDDE3] px-2.5 text-[12.5px] font-semibold text-[#4B4B52] hover:border-primary hover:text-primary"
                >
                  전액 사용
                </button>
              )}
            </div>
          </label>

          {error && (
            <span role="alert" className="text-[12.5px] font-semibold text-primary">
              {error}
            </span>
          )}

          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="mt-1 w-full rounded-[11px] border-2 border-primary-dark bg-primary py-3 text-[14.5px] font-bold text-white shadow-tactile-sm active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "요청 중..." : "결제하러 가기"}
          </button>
        </div>
      </div>
    </div>
  );
}
