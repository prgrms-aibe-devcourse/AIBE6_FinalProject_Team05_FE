"use client";

import { createPortal } from "react-dom";
import { useEscapeAndScrollLock } from "@/hooks/useEscapeAndScrollLock";

// 등급 안내 모달(GradeGuideModal) 전에 한 번 더 보여주는 선택 모달 - 상대편에 이미 매물/구매입찰이
// 있어서 즉시 거래가 가능한 상황이라도, 사용자가 원하는 가격에 직접 입찰/등록하는 쪽을 선택할 수
// 있게 한다(#238). "buy"면 즉시구매 vs 구매입찰 등록, "sell"이면 즉시판매 vs 매물 등록을 묻는다.
export default function TradeMethodModal({
  isOpen,
  mode,
  matchedPrice,
  onClose,
  onChooseInstant,
  onChooseAlternative,
}: {
  isOpen: boolean;
  mode: "buy" | "sell";
  matchedPrice: number;
  onClose: () => void;
  onChooseInstant: () => void;
  onChooseAlternative: () => void;
}) {
  useEscapeAndScrollLock(isOpen, onClose);

  if (!isOpen) return null;

  const copy =
    mode === "buy"
      ? {
          title: "구매 방식 선택",
          desc: "이 등급에 이미 등록된 매물이 있어요. 지금 바로 살지, 원하는 가격에 구매입찰을 걸어둘지 선택해 주세요.",
          instantLabel: "즉시구매",
          instantDesc: `${matchedPrice.toLocaleString("ko-KR")}원에 바로 구매`,
          alternativeLabel: "구매입찰 등록",
          alternativeDesc: "원하는 가격에 입찰을 걸고 매물이 나올 때까지 대기",
        }
      : {
          title: "판매 방식 선택",
          desc: "이 등급에 이미 구매입찰이 있어요. 지금 바로 팔지, 원하는 가격에 매물을 등록할지 선택해 주세요.",
          instantLabel: "즉시판매",
          instantDesc: `${matchedPrice.toLocaleString("ko-KR")}원에 바로 판매`,
          alternativeLabel: "매물 등록",
          alternativeDesc: "원하는 가격에 매물을 올리고 구매자가 나올 때까지 대기",
        };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
    >
      <div
        className="w-full max-w-[400px] rounded-2xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-[16px] font-extrabold">{copy.title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[18px] font-bold text-[#9A9AA2] hover:bg-neutral"
          >
            ×
          </button>
        </div>
        <p className="mb-5 text-[12.5px] leading-relaxed text-[#8A8A92]">{copy.desc}</p>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onChooseInstant}
            className="rounded-[11px] border-2 border-primary-dark bg-primary px-4 py-3.5 text-left text-white shadow-tactile-sm transition active:translate-y-0.5"
          >
            <span className="block text-[14.5px] font-bold">{copy.instantLabel}</span>
            <span className="block text-[12px] font-semibold text-white/85">
              {copy.instantDesc}
            </span>
          </button>
          <button
            type="button"
            onClick={onChooseAlternative}
            className="rounded-[11px] border border-[#DDDDE3] bg-white px-4 py-3.5 text-left transition hover:border-primary"
          >
            <span className="block text-[14.5px] font-bold text-ink">
              {copy.alternativeLabel}
            </span>
            <span className="block text-[12px] font-semibold text-[#8A8A92]">
              {copy.alternativeDesc}
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
