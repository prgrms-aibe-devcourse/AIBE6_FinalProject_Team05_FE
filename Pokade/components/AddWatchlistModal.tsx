"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useEscapeAndScrollLock } from "@/hooks/useEscapeAndScrollLock";
import { ApiError } from "@/lib/apiClient";
import { loginUrlFor } from "@/lib/authRedirect";
import { addWatchlist } from "@/lib/watchlistApi";
import { useUserStore } from "@/store/useUserStore";
import { WatchlistResponse } from "@/types/watchlist";

// BE는 0보다 큰 정수만 요구(@Positive)하지만, 1원처럼 실질적 의미가 없는 목표가 등록을
// 막기 위해 FE에서 더 엄격한 최소값을 둔다. BE 요구사항이 바뀐 게 아니라 UX상의 선제 검증.
const MIN_TARGET_PRICE = 100;

interface AddWatchlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardId: number;
  variantId?: number | null;
  onSuccess?: (created: WatchlistResponse) => void;
}

// 카드 상세/마켓 등 여러 화면에서 재사용할 워치리스트 등록 모달.
// 목표 구매가/판매가 중 최소 하나 입력 필요(BE 검증과 동일 규칙을 클라이언트에서도 선제 검사).
export default function AddWatchlistModal({
  isOpen,
  onClose,
  cardId,
  variantId,
  onSuccess,
}: AddWatchlistModalProps) {
  const authStatus = useUserStore((s) => s.status);
  const router = useRouter();
  const pathname = usePathname();

  const [buyPrice, setBuyPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEscapeAndScrollLock(isOpen, onClose);

  // 비로그인 상태에서 모달을 열려고 하면 로그인 페이지로 유도 (useRequireAuth와 동일한 리다이렉트 방식).
  useEffect(() => {
    if (isOpen && authStatus === "unauthenticated") {
      onClose();
      router.replace(loginUrlFor(pathname));
    }
  }, [isOpen, authStatus, onClose, pathname, router]);

  const resetForm = () => {
    setBuyPrice("");
    setSellPrice("");
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const parsePrice = (value: string): number | undefined => {
    return value.trim() ? Number(value) : undefined;
  };

  const handleSubmit = async () => {
    const buy = parsePrice(buyPrice);
    const sell = parsePrice(sellPrice);

    if (buy == null && sell == null) {
      setError("목표 구매가 또는 판매가 중 하나는 입력해야 합니다.");
      return;
    }
    const invalid = [buy, sell].some(
      (v) => v != null && (!Number.isInteger(v) || v < MIN_TARGET_PRICE),
    );
    if (invalid) {
      setError(`가격은 ${MIN_TARGET_PRICE.toLocaleString("ko-KR")}원 이상의 정수로 입력해 주세요.`);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const created = await addWatchlist({
        cardId,
        variantId: variantId ?? undefined,
        targetBuyPrice: buy,
        targetSellPrice: sell,
      });
      resetForm();
      onSuccess?.(created);
      onClose();
    } catch (err) {
      // DUPLICATE_WATCHLIST/WATCHLIST_LIMIT_EXCEEDED/TARGET_PRICE_REQUIRED 모두
      // BE가 내려주는 msg를 그대로 사용자에게 보여준다(이미 사용자 친화적인 문구).
      setError(err instanceof ApiError ? err.message : "워치리스트 등록에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || authStatus !== "authenticated") return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label="워치리스트 등록"
    >
      <div
        className="w-full max-w-[380px] rounded-2xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-[16px] font-extrabold">워치리스트 등록</h2>
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
            목표 구매가 (이 가격 이하로 내려가면 알림)
            <input
              type="number"
              min={MIN_TARGET_PRICE}
              value={buyPrice}
              onChange={(e) => setBuyPrice(e.target.value)}
              placeholder="예: 100000"
              className="rounded-[9px] border border-[#DDDDE3] px-3 py-2 text-[13.5px] outline-none focus:border-primary"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-[#4B4B52]">
            목표 판매가 (이 가격 이상으로 오르면 알림)
            <input
              type="number"
              min={MIN_TARGET_PRICE}
              value={sellPrice}
              onChange={(e) => setSellPrice(e.target.value)}
              placeholder="예: 150000"
              className="rounded-[9px] border border-[#DDDDE3] px-3 py-2 text-[13.5px] outline-none focus:border-primary"
            />
          </label>

          {error && <span className="text-[12.5px] font-semibold text-primary">{error}</span>}

          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="mt-1 w-full rounded-[11px] border-2 border-primary-dark bg-primary py-3 text-[14.5px] font-bold text-white shadow-tactile-sm active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "등록 중..." : "등록"}
          </button>
        </div>
      </div>
    </div>
  );
}
