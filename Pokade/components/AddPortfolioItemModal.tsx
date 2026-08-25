"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CardImage from "@/components/CardImage";
import GradeBadge, { Grade } from "@/components/GradeBadge";
import PriceInput from "@/components/PriceInput";
import { useEscapeAndScrollLock } from "@/hooks/useEscapeAndScrollLock";
import { ApiError } from "@/lib/apiClient";
import { fetchCardDetail, fetchCardsByKeywordPage } from "@/lib/cardApi";
import { addPortfolioItem, updatePortfolioItem } from "@/lib/portfolioApi";
import { CardDetailResponse, CardResponse, VariantSummary, variantLabel } from "@/types/card";
import { PortfolioItemResponse } from "@/types/portfolio";

const MIN_QUERY_LENGTH = 2;

interface SelectedCard {
  id: number;
  name: string;
  setName: string;
  imageUrl: string;
  variants: VariantSummary[];
}

function toSelectedCard(detail: CardDetailResponse): SelectedCard {
  return {
    id: detail.id,
    name: detail.nameKo ?? detail.name,
    setName: detail.setName,
    imageUrl: detail.imageMedium || detail.imageSmall,
    variants: detail.variants,
  };
}

type AddPortfolioItemModalProps = {
  isOpen: boolean;
  onClose: () => void;
  // create/edit 모드에서만 사용 — from-grade 모드는 onCardConfirm을 대신 쓴다.
  onSuccess?: (result: PortfolioItemResponse) => void;
} & (
  | { mode?: "create" }
  | {
      mode: "edit";
      item: PortfolioItemResponse;
    }
  | {
      // AI 등급 진단 결과(FR-AI-04) 등록용 카드 선택 — 여기서는 등록을 실행하지 않고 고른 카드만
      // 돌려준다. 실제 등록은 ResultView의 확인 다이얼로그에서 한 번 더 확인 후 수행한다.
      mode: "from-grade";
      aiGrade: Grade | null;
      initialCardId?: number | null;
      initialVariantId?: number | null;
      onCardConfirm: (card: { id: number; name: string; imageUrl: string; variantId: number | null }) => void;
    }
);

// 도감 등록(카드 검색부터)과 수정(수량·취득가만) 겸용 모달 — 등록 UI는 app/listings/new의
// 카드 검색 패턴을, 폼 셸은 AddWatchlistModal을 참고했다.
export default function AddPortfolioItemModal(props: AddPortfolioItemModalProps) {
  const { isOpen, onClose, onSuccess } = props;
  const mode = props.mode ?? "create";
  const editingItem = props.mode === "edit" ? props.item : null;
  const fromGrade = props.mode === "from-grade" ? props : null;

  const [selectedCard, setSelectedCard] = useState<SelectedCard | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<CardResponse[]>([]);
  const [searching, setSearching] = useState(false);

  const [quantity, setQuantity] = useState("1");
  const [acquiredPrice, setAcquiredPrice] = useState("");
  const [acquiredAt, setAcquiredAt] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectRequestIdRef = useRef(0);

  const resetForm = useCallback(() => {
    setSelectedCard(null);
    setSelectedVariantId(null);
    setQuery("");
    setSuggestions([]);
    setQuantity("1");
    setAcquiredPrice("");
    setAcquiredAt("");
    setError(null);
  }, []);

  // preferredVariantId — 카드 수정을 다시 열었을 때 이전에 골랐던 판본을 유지하기 위함.
  // 없거나 이 카드에 더 이상 없는 판본이면 대표 판본으로 대체한다.
  const selectCardById = (cardId: number, preferredVariantId?: number | null) => {
    const requestId = ++selectRequestIdRef.current;
    fetchCardDetail(cardId)
      .then((detail) => {
        if (selectRequestIdRef.current !== requestId) return;
        const card = toSelectedCard(detail);
        setSelectedCard(card);
        const preferred =
          preferredVariantId != null ? card.variants.find((v) => v.id === preferredVariantId) : undefined;
        const primary = preferred ?? card.variants.find((v) => v.primary) ?? card.variants[0];
        setSelectedVariantId(primary?.id ?? null);
        setError(null);
      })
      .catch(() => {
        if (selectRequestIdRef.current !== requestId) return;
        setError("카드 정보를 불러오지 못했습니다. 다시 선택해 주세요.");
      });
  };

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  useEscapeAndScrollLock(isOpen, handleClose);

  // 모달이 열릴 때마다 폼 초기화: 수정 모드면 기존 항목 값으로, 등록 모드면 빈 값으로.
  useEffect(() => {
    if (!isOpen) return;
    if (editingItem) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 모달 오픈 시 기존 값으로 1회 채움
      setQuantity(String(editingItem.quantity));
      setAcquiredPrice(editingItem.acquiredPrice != null ? String(editingItem.acquiredPrice) : "");
      setAcquiredAt(editingItem.acquiredAt ? editingItem.acquiredAt.slice(0, 10) : "");
      setError(null);
    } else {
      resetForm();
      if (fromGrade?.initialCardId != null) {
        selectCardById(fromGrade.initialCardId, fromGrade.initialVariantId);
      }
    }
    // editingItem은 매 렌더 새 참조(부모가 배열에서 find)라 id만 의존성으로 둔다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingItem?.id]);

  // 카드 검색 자동완성 (디바운스) — 카드 검색 UI가 있는 모드(등록/AI 진단 등록)에서만 동작
  useEffect(() => {
    if (mode === "edit") return;
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      fetchCardsByKeywordPage(trimmed)
        .then((page) => {
          if (!cancelled) setSuggestions(page.content.slice(0, 8));
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mode, query]);

  const handleSubmit = async () => {
    if (mode !== "edit" && !selectedCard) {
      setError("카드를 선택해 주세요.");
      return;
    }

    // from-grade 모드는 API를 직접 호출하지 않는다 — 고른 카드를 그대로 돌려주면
    // ResultView가 확인 다이얼로그를 다시 띄운 뒤 실제 등록을 수행한다.
    if (mode === "from-grade" && fromGrade) {
      fromGrade.onCardConfirm({
        id: selectedCard!.id,
        name: selectedCard!.name,
        imageUrl: selectedCard!.imageUrl,
        variantId: selectedVariantId,
      });
      handleClose();
      return;
    }

    const quantityNumber = Number(quantity);
    if (!quantity || !Number.isInteger(quantityNumber) || quantityNumber < 1) {
      setError("수량은 1 이상의 정수로 입력해 주세요.");
      return;
    }
    const acquiredPriceNumber = acquiredPrice.trim() ? Number(acquiredPrice) : undefined;
    if (
      acquiredPriceNumber != null &&
      (!Number.isInteger(acquiredPriceNumber) || acquiredPriceNumber < 0)
    ) {
      setError("카드 구매가는 0 이상의 정수로 입력해 주세요.");
      return;
    }
    const acquiredAtIso = acquiredAt ? new Date(acquiredAt).toISOString() : undefined;

    setSubmitting(true);
    setError(null);
    try {
      const result =
        mode === "edit" && editingItem
          ? await updatePortfolioItem(editingItem.id, {
              quantity: quantityNumber,
              acquiredPrice: acquiredPriceNumber,
              acquiredAt: acquiredAtIso,
            })
          : await addPortfolioItem({
              cardId: selectedCard!.id,
              variantId: selectedVariantId ?? undefined,
              quantity: quantityNumber,
              acquiredPrice: acquiredPriceNumber,
              acquiredAt: acquiredAtIso,
            });
      onSuccess?.(result);
      handleClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : mode === "edit"
            ? "도감 항목 수정에 실패했습니다."
            : "도감 등록에 실패했습니다.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const title = mode === "edit" ? "보유 카드 수정" : mode === "from-grade" ? "카드 선택" : "도감에 카드 추가";
  const inputCls =
    "rounded-[9px] border border-[#DDDDE3] px-3 py-2 text-[13.5px] outline-none focus:border-primary";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="w-full max-w-[420px] rounded-2xl bg-white p-6"
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
          {mode === "edit" && editingItem ? (
            <div className="flex items-center gap-3 rounded-[11px] border border-[#DDDDE3] px-3.5 py-3">
              <div className="relative h-14 w-10 flex-shrink-0 overflow-hidden rounded-[7px] bg-[#F2F2F5]">
                <CardImage
                  src={editingItem.cardImageSmall ?? undefined}
                  alt={editingItem.cardName ?? "카드"}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14.5px] font-bold text-ink">
                  {editingItem.cardName ?? "알 수 없는 카드"}
                </div>
                {editingItem.variantName && (
                  <div className="truncate text-xs text-[#8A8A92]">
                    {variantLabel(editingItem.variantName)}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <label className="text-[13px] font-semibold text-[#4B4B52]">카드</label>
              {selectedCard ? (
                <div className="flex items-center gap-3 rounded-[11px] border border-[#DDDDE3] px-3.5 py-3">
                  <div className="relative h-14 w-10 flex-shrink-0 overflow-hidden rounded-[7px] bg-[#F2F2F5]">
                    <CardImage src={selectedCard.imageUrl} alt={selectedCard.name} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14.5px] font-bold text-ink">
                      {selectedCard.name}
                    </div>
                    <div className="truncate text-xs text-[#8A8A92]">{selectedCard.setName}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCard(null);
                      setSelectedVariantId(null);
                    }}
                    className="flex-shrink-0 text-[12.5px] font-semibold text-[#8A8A92] hover:text-primary"
                  >
                    다시 선택
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                      const next = e.target.value;
                      setQuery(next);
                      setSuggestions([]);
                      setSearching(next.trim().length >= MIN_QUERY_LENGTH);
                    }}
                    placeholder="카드 이름으로 검색 (2자 이상)"
                    className={`w-full ${inputCls}`}
                  />
                  {query.trim().length >= MIN_QUERY_LENGTH && (
                    <div className="absolute z-10 mt-1.5 max-h-[280px] w-full overflow-y-auto rounded-[11px] border border-[#EDEDF0] bg-white shadow-card">
                      {searching ? (
                        <div className="px-3.5 py-3 text-[13px] text-[#8A8A92]">검색 중...</div>
                      ) : suggestions.length === 0 ? (
                        <div className="px-3.5 py-3 text-[13px] text-[#8A8A92]">
                          검색 결과가 없습니다.
                        </div>
                      ) : (
                        suggestions.map((card) => (
                          <button
                            key={card.id}
                            type="button"
                            onClick={() => {
                              setQuery("");
                              setSuggestions([]);
                              selectCardById(card.id);
                            }}
                            className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-neutral"
                          >
                            <div className="relative h-11 w-8 flex-shrink-0 overflow-hidden rounded-[7px] bg-[#F2F2F5]">
                              <CardImage
                                src={card.imageMedium || card.imageSmall}
                                alt={card.nameKo ?? card.name}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-[13.5px] font-bold text-ink">
                                {card.nameKo ?? card.name}
                              </div>
                              <div className="truncate text-xs text-[#8A8A92]">
                                {card.setName}
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {selectedCard && selectedCard.variants.length > 1 && (
                <>
                  <label className="text-[13px] font-semibold text-[#4B4B52]">판본</label>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCard.variants.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVariantId(v.id)}
                        className={`rounded-full border px-3 py-1.5 text-[12.5px] font-bold transition ${
                          selectedVariantId === v.id
                            ? "border-primary bg-primary text-white"
                            : "border-[#DDDDE3] bg-white text-[#4B4B52] hover:border-primary hover:text-primary"
                        }`}
                      >
                        {variantLabel(v.variantName)}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {fromGrade && (
            <div className="flex items-center gap-2.5 rounded-[11px] bg-neutral px-3.5 py-3">
              <span className="text-[13px] font-semibold text-[#4B4B52]">AI 예상 등급</span>
              <GradeBadge grade={fromGrade.aiGrade ?? undefined} />
            </div>
          )}

          {mode !== "from-grade" && (
            <>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-[#4B4B52]">
                수량
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className={inputCls}
                />
              </label>

              <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-[#4B4B52]">
                카드 구매가 (선택)
                <PriceInput
                  value={acquiredPrice}
                  onChange={setAcquiredPrice}
                  placeholder="예: 50,000"
                  className={inputCls}
                />
              </label>

              <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-[#4B4B52]">
                취득일 (선택)
                <input
                  type="date"
                  value={acquiredAt}
                  onChange={(e) => setAcquiredAt(e.target.value)}
                  className={inputCls}
                />
              </label>
            </>
          )}

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
            {mode === "from-grade"
              ? "확인"
              : submitting
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
