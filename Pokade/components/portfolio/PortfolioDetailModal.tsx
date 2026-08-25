import { useEffect, useRef, useState } from "react";
import CardImage from "@/components/CardImage";
import { ApiError } from "@/lib/apiClient";
import { updatePortfolioItemThumbnail } from "@/lib/portfolioApi";
import { formatKrw } from "@/lib/portfolioFormat";
import { PortfolioItemPnlResponse, PortfolioItemResponse } from "@/types/portfolio";

// 그리드에서 카드를 탭하면 뜨는 상세 카드 — 도감 앨범 페이지에서 슬롯을 눌러 도감 정보를 보는 느낌.
export default function PortfolioDetailModal({
  item,
  pnl,
  pnlError,
  pnlLoading,
  deleting,
  onClose,
  onShowPnl,
  onEdit,
  onDelete,
  onThumbnailChange,
}: {
  item: PortfolioItemResponse;
  pnl?: PortfolioItemPnlResponse;
  pnlError?: string;
  pnlLoading: boolean;
  deleting: boolean;
  onClose: () => void;
  onShowPnl: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onThumbnailChange: (updated: PortfolioItemResponse) => void;
}) {
  const displayName = item.cardNameKo ?? item.cardName ?? "알 수 없는 카드";
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleThumbnailPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingThumbnail(true);
    setThumbnailError(null);
    try {
      const updated = await updatePortfolioItemThumbnail(item.id, file);
      onThumbnailChange(updated);
    } catch (err) {
      setThumbnailError(err instanceof ApiError ? err.message : "표지 사진 변경에 실패했습니다.");
    } finally {
      setUploadingThumbnail(false);
    }
  };

  // 배경(그리드) 클릭을 막지는 못하지만(포커스 트랩은 별도 과제), 최소한 Escape로는 닫을 수 있게 한다.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="portfolio-detail-modal-title"
        className="w-full max-w-[360px] overflow-hidden rounded-lg border border-[#E3E3E8] bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative aspect-[5/7] w-full bg-[#F2F2F5]">
          <CardImage src={item.cardImageSmall ?? undefined} alt={displayName} label="카드" />
          {item.quantity > 1 && (
            <span className="absolute right-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-[12px] font-bold text-white">
              x{item.quantity}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={handleThumbnailPick}
          />
          <button
            type="button"
            disabled={uploadingThumbnail}
            onClick={() => fileInputRef.current?.click()}
            aria-label="표지 사진 변경"
            className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 disabled:opacity-60"
          >
            {uploadingThumbnail ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h3l2-2h6l2 2h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
            )}
          </button>
        </div>
        {thumbnailError && (
          <div role="alert" className="px-5 pt-3 text-[12.5px] font-semibold text-primary">
            {thumbnailError}
          </div>
        )}
        <div className="p-5">
          <div id="portfolio-detail-modal-title" className="text-[16px] font-extrabold">
            {displayName}
          </div>
          {/* 세트/버전명은 실물 카드에 인쇄된 표기(영문)를 그대로 보여준다 — 한글 번역(variantLabel) 미적용. */}
          {item.variantName && (
            <div className="mt-0.5 text-[12.5px] text-[#9A9AA2]">{item.variantName}</div>
          )}
          <div className="mt-4 flex items-center justify-between text-[13px]">
            <span className="text-[#8A8A92]">카드 구매가</span>
            <span className="font-semibold">
              {item.acquiredPrice != null ? `${item.acquiredPrice.toLocaleString("ko-KR")}원` : "-"}
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[13px]">
            <span className="text-[#8A8A92]">현재 시세</span>
            <span className="text-[15px] font-extrabold text-ink">
              {formatKrw(item.currentMarketPrice, item.currency)}
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[13px]">
            <span className="text-[#8A8A92]">손익</span>
            {pnl ? (
              <span className={`font-bold ${pnl.pnlAmount >= 0 ? "text-primary" : "text-secondary"}`}>
                {pnl.pnlAmount >= 0 ? "+" : ""}
                {pnl.pnlAmount.toLocaleString("ko-KR")}원 ({pnl.pnlRate.toFixed(2)}%)
              </span>
            ) : pnlError ? (
              <span className="text-[#9A9AA2]">{pnlError}</span>
            ) : (
              <button
                type="button"
                disabled={pnlLoading}
                onClick={onShowPnl}
                className="font-semibold text-[#8A8A92] underline decoration-dotted hover:text-primary disabled:opacity-50"
              >
                {pnlLoading ? "조회 중..." : "손익 보기"}
              </button>
            )}
          </div>

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="flex-1 rounded-[10px] border border-[#DDDDE3] py-2.5 text-[13px] font-bold text-[#4B4B52] hover:border-primary hover:text-primary"
            >
              수정
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={onDelete}
              className="flex-1 rounded-[10px] border border-[#F6C6C6] bg-[#FFF1F1] py-2.5 text-[13px] font-bold text-[#C21414] disabled:opacity-50"
            >
              삭제
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
