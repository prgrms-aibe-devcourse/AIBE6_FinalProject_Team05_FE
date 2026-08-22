"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useEscapeAndScrollLock } from "@/hooks/useEscapeAndScrollLock";
import { ApiError } from "@/lib/apiClient";
import { stripFieldPrefix } from "@/lib/apiErrorMessage";
import { loginUrlFor } from "@/lib/authRedirect";
import { addWatchlist, updateWatchlist } from "@/lib/watchlistApi";
import { useUserStore } from "@/store/useUserStore";
import { WatchlistResponse } from "@/types/watchlist";

// BE는 0보다 큰 정수만 요구(@Positive)하지만, 1원처럼 실질적 의미가 없는 목표가 등록을
// 막기 위해 FE에서 더 엄격한 최소값을 둔다. BE 요구사항이 바뀐 게 아니라 UX상의 선제 검증.
const MIN_TARGET_PRICE = 100;

// BE의 @Max와 같은 값(#238, BE cb32a3e). FE에서도 막는 이유가 두 가지다:
//  - 서버까지 갔다 오지 않고 바로 알려주는 편이 빠르다
//  - int 범위를 넘는 값(21억 초과)은 BE가 역직렬화 단계에서 400을 내는데, 이건 전역 핸들러를
//    타지 않아 code/msg 없는 응답이 온다 → 화면에 "요청이 실패했습니다. (400)"만 뜬다.
//    여기서 먼저 걸러 그 경로 자체를 없앤다.
// 검색 필터의 자릿수 제한(app/search/SearchFilterSidebar.tsx의 sanitizePriceInput)은 PRICE_MAX
// (천만, 8자리) 전용인 데다 콤마 포맷·커서 보정이 type="text"를 전제로 해서 여기 재사용하지 않는다.
const MAX_TARGET_PRICE = 100_000_000;

type AddWatchlistModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: WatchlistResponse) => void;
  // 목표가를 얼마로 잡을지 감을 주기 위한 현재 시세 문구(예: "280,000원"). 호출 화면이 이미
  // 계산해 둔 값을 그대로 받는다 — 모달이 따로 조회하지 않는다(#238).
  currentPriceLabel?: string;
} & (
  | {
      mode?: "create";
      cardId: number;
      variantId?: number | null;
    }
  | {
      mode: "edit";
      watchlistId: number;
      initialTargetBuyPrice?: number | null;
      initialTargetSellPrice?: number | null;
    }
);

// 카드 상세/마켓 등 여러 화면에서 재사용할 워치리스트 등록·수정 겸용 모달.
// 목표 구매가/판매가 중 최소 하나 입력 필요(BE 검증과 동일 규칙을 클라이언트에서도 선제 검사).
export default function AddWatchlistModal(props: AddWatchlistModalProps) {
  const { isOpen, onClose, onSuccess, currentPriceLabel } = props;
  const mode = props.mode ?? "create";
  const initialTargetBuyPrice = props.mode === "edit" ? props.initialTargetBuyPrice : undefined;
  const initialTargetSellPrice = props.mode === "edit" ? props.initialTargetSellPrice : undefined;

  const authStatus = useUserStore((s) => s.status);
  const router = useRouter();
  const pathname = usePathname();

  const [buyPrice, setBuyPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const buyPriceInputRef = useRef<HTMLInputElement>(null);

  // buy/sell 기본값은 빈 문자열(등록 모드). 수정 모드 오픈 시 아래 useEffect가 기존 값으로 덮어쓴다.
  const resetForm = useCallback((buy = "", sell = "") => {
    setBuyPrice(buy);
    setSellPrice(sell);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  useEscapeAndScrollLock(isOpen, handleClose);

  // 비로그인 상태에서 모달을 열려고 하면 로그인 페이지로 유도 (useRequireAuth와 동일한 리다이렉트 방식).
  useEffect(() => {
    if (isOpen && authStatus === "unauthenticated") {
      onClose();
      router.replace(loginUrlFor(pathname));
    }
  }, [isOpen, authStatus, onClose, pathname, router]);

  // 모달이 열릴 때마다 폼을 초기화한다: 수정 모드면 기존 목표가로, 등록 모드면 빈 값으로.
  // (등록 모드에서 이 effect가 없으면 직전 수정 모달에 남아있던 값이 다음 등록 오픈 때 보일 수 있다.)
  useEffect(() => {
    if (!isOpen) return;
    if (mode === "edit") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 모달 오픈 시 기존 목표가로 1회 채움
      resetForm(
        initialTargetBuyPrice != null ? String(initialTargetBuyPrice) : "",
        initialTargetSellPrice != null ? String(initialTargetSellPrice) : "",
      );
    } else {
      resetForm();
    }
  }, [isOpen, mode, initialTargetBuyPrice, initialTargetSellPrice, resetForm]);

  // 모달이 열리면 첫 입력 필드(목표 구매가)로 포커스 이동 (키보드 사용자 편의).
  useEffect(() => {
    if (isOpen && authStatus === "authenticated") {
      buyPriceInputRef.current?.focus();
    }
  }, [isOpen, authStatus]);

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
    if ([buy, sell].some((v) => v != null && v > MAX_TARGET_PRICE)) {
      setError("목표가는 1억원 이하로 입력해주세요.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result =
        props.mode === "edit"
          ? await updateWatchlist(props.watchlistId, { targetBuyPrice: buy, targetSellPrice: sell })
          : await addWatchlist({
              cardId: props.cardId,
              variantId: props.variantId ?? undefined,
              targetBuyPrice: buy,
              targetSellPrice: sell,
            });
      onSuccess?.(result);
      onClose();
    } catch (err) {
      // DUPLICATE_WATCHLIST/WATCHLIST_LIMIT_EXCEEDED/TARGET_PRICE_REQUIRED/WATCHLIST_NOT_FOUND/
      // INVALID_TARGET_PRICE_RANGE 모두 BE가 내려주는 msg를 그대로 보여준다(이미 사용자 친화적).
      // 다만 bean validation(@Max 등)에서 온 것만 "targetBuyPrice: ..."처럼 필드명이 앞에 붙어
      // 오므로 그 접두사만 걷어낸다(#238) — 나머지 메시지는 매칭되지 않아 그대로 통과한다.
      setError(
        err instanceof ApiError
          ? stripFieldPrefix(err.message)
          : mode === "edit"
            ? "목표가 수정에 실패했습니다."
            : "관심 등록에 실패했습니다.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || authStatus !== "authenticated") return null;

  // 수정 모드라도 아직 목표가가 하나도 없으면 사용자 입장에선 "처음 정하는" 것이다(#238) —
  // 관심 등록은 하트로만 하고 목표가는 나중에 넣는 흐름이라, 값이 빈 카드에 "수정"이라고
  // 적혀 있으면 고칠 게 없는데 왜 수정이냐는 인상을 준다.
  const hasExistingTarget = initialTargetBuyPrice != null || initialTargetSellPrice != null;
  const title = mode === "edit" ? (hasExistingTarget ? "목표가 수정" : "목표가 설정") : "관심 등록";

  // 이미 설정돼 있던 목표가를 비워서 저장하려는 시도. BE는 안 보낸 필드를 "기존 값 유지"로 해석하므로
  // (Watchlist.updateTargetPrices) 그대로 보내면 지운 값이 조용히 되살아난다 - 실패했다는 신호가
  // 아무 데도 없어서, 아예 저장을 막고 이유를 알려준다. "목표가 지우기"는 지원하지 않기로 확정된 사양.
  // 등록 모드에서는 initial*이 undefined라 항상 false지만, 규칙이 편집 전용임을 드러내려 mode도 함께 본다.
  const clearedExistingTarget =
    mode === "edit" &&
    ((initialTargetBuyPrice != null && !buyPrice.trim()) ||
      (initialTargetSellPrice != null && !sellPrice.trim()));

  // 지우기 시도는 기존 "둘 다 비어있음" 가드와 겹칠 수 있다(원래 구매가만 있던 항목에서 그걸 비운 경우).
  // 그때는 더 구체적인 원인인 이쪽을 보여준다 - 남은 케이스(원래 목표가가 없던 항목에서 둘 다 빈 채로
  // 저장)는 handleSubmit의 기존 가드가 그대로 담당한다.
  const notice = clearedExistingTarget
    ? "목표가를 지우려면 삭제 후 다시 등록해주세요."
    : error;

  // placeholder는 카드와 무관한 고정값(예: 100000) 대신 이 카드의 현재 시세를 예시로 쓴다 —
  // 자릿수 감이 바로 잡히고, 구매/판매 목표를 현재가 기준 위아래로 떠올리기 쉬워진다.
  // 시세를 모르는 카드(정보 없음)는 기존 고정 예시로 되돌아간다.
  const priceDigits = currentPriceLabel?.replace(/\D/g, "") ?? "";
  const examplePrice = priceDigits ? Number(priceDigits).toLocaleString("ko-KR") : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="w-full max-w-[380px] rounded-2xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-[16px] font-extrabold">{title}</h2>
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
          {/* 목표가를 얼마로 잡을지 판단하려면 지금 얼마인지가 있어야 한다(#238) —
              예전에는 모달을 닫고 목록으로 나가야 현재 시세를 볼 수 있었다. */}
          {currentPriceLabel && (
            <div className="flex items-center justify-between rounded-[9px] bg-neutral px-3 py-2 text-[12.5px]">
              <span className="font-semibold text-[#8A8A92]">현재 시세</span>
              <span className="font-bold text-ink">{currentPriceLabel}</span>
            </div>
          )}

          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-[#4B4B52]">
            목표 구매가 (이 가격 이하로 내려가면 알림)
            <input
              ref={buyPriceInputRef}
              type="number"
              min={MIN_TARGET_PRICE}
              max={MAX_TARGET_PRICE}
              value={buyPrice}
              onChange={(e) => setBuyPrice(e.target.value)}
              placeholder={examplePrice ? `예: ${examplePrice}` : "예: 100000"}
              className="rounded-[9px] border border-[#DDDDE3] px-3 py-2 text-[13.5px] outline-none focus:border-primary"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-[#4B4B52]">
            목표 판매가 (이 가격 이상으로 오르면 알림)
            <input
              type="number"
              min={MIN_TARGET_PRICE}
              max={MAX_TARGET_PRICE}
              value={sellPrice}
              onChange={(e) => setSellPrice(e.target.value)}
              placeholder={examplePrice ? `예: ${examplePrice}` : "예: 150000"}
              className="rounded-[9px] border border-[#DDDDE3] px-3 py-2 text-[13.5px] outline-none focus:border-primary"
            />
          </label>

          {notice && (
            <span role="alert" className="text-[12.5px] font-semibold text-primary">
              {notice}
            </span>
          )}

          <button
            type="button"
            disabled={submitting || clearedExistingTarget}
            onClick={handleSubmit}
            className="mt-1 w-full rounded-[11px] border-2 border-primary-dark bg-primary py-3 text-[14.5px] font-bold text-white shadow-tactile-sm active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting
              ? mode === "edit"
                ? "저장 중..."
                : "등록 중..."
              : mode === "edit"
                ? "저장"
                : "등록"}
          </button>
        </div>
      </div>
    </div>
  );
}
