"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import CardImage from "@/components/CardImage";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { ApiError } from "@/lib/apiClient";
import { createListing } from "@/lib/listingApi";
import { fetchCardDetail, fetchCardsByKeywordPage, fetchPriceSummary } from "@/lib/cardApi";
import {
  CardDetailResponse,
  CardResponse,
  parseCardId,
  VariantSummary,
  variantLabel,
} from "@/types/card";
import { ListingGrade, PriceSummaryResponse } from "@/types/price";

const MIN_QUERY_LENGTH = 2;
const GRADE_OPTIONS: ListingGrade[] = ["S", "A", "B", "PSA10", "PSA9", "PSA8"];

// 입력 가격이 현재 최저 시세 대비 이 비율 이상 벗어나면 참고용 경고를 보여준다 — 등록 자체는 막지 않는다.
const PRICE_OUTLIER_THRESHOLD = 0.3;

// 등급 선택 가이드 — 각 등급의 판단 기준을 간단히 안내한다.
const GRADE_GUIDE: Record<ListingGrade, string> = {
  S: "완전품 수준 — 스크래치, 모서리 눌림, 백색 반점 등 흠집이 육안으로 보이지 않음",
  A: "미세한 사용감 — 모서리에 아주 약간의 눌림이나 가벼운 스크래치가 있으나 거의 티 나지 않음",
  B: "사용감 있음 — 모서리 마모, 스크래치, 백색 반점 등이 육안으로 확인되나 거래 가능한 상태",
  PSA10: "PSA 감정 등급 10 (Gem Mint) — 감정사가 완전품으로 판정",
  PSA9: "PSA 감정 등급 9 (Mint) — 극히 미세한 결점만 존재",
  PSA8: "PSA 감정 등급 8 (NM-MT) — 육안으로 확인 가능한 경미한 결점 존재",
};

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

export default function NewListingPage() {
  return (
    <Suspense fallback={null}>
      <NewListingForm />
    </Suspense>
  );
}

function NewListingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = useRequireAuth();

  const [selectedCard, setSelectedCard] = useState<SelectedCard | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<CardResponse[]>([]);
  const [searching, setSearching] = useState(false);

  const [price, setPrice] = useState("");
  const [grade, setGrade] = useState<ListingGrade | "">("");

  const [priceSummary, setPriceSummary] = useState<PriceSummaryResponse | null>(null);
  const [priceSummaryLoading, setPriceSummaryLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 진행 중인 카드 상세 조회 중 가장 마지막 요청만 상태에 반영하기 위한 순번 —
  // 먼저 보낸 요청(예: ?cardId= 진입)이 나중에 끝나 검색으로 새로 고른 카드를 덮어쓰는 것을 방지.
  const selectRequestIdRef = useRef(0);

  // 카드 상세(판본 목록 포함)를 조회해서 선택된 카드로 세팅 — 대표 판본을 기본 선택.
  const selectCardById = (cardId: number) => {
    const requestId = ++selectRequestIdRef.current;
    fetchCardDetail(cardId)
      .then((detail) => {
        if (selectRequestIdRef.current !== requestId) return; // 그 사이 다른 카드가 선택됨 — 무시
        const card = toSelectedCard(detail);
        setSelectedCard(card);
        const primary = card.variants.find((v) => v.primary) ?? card.variants[0];
        setSelectedVariantId(primary?.id ?? null);
        setError(null);
        setPriceSummaryLoading(true);
      })
      .catch(() => {
        if (selectRequestIdRef.current !== requestId) return;
        setError("카드 정보를 불러오지 못했습니다. 다시 선택해 주세요.");
      });
  };

  // ?cardId= 로 진입했으면 카드 상세를 미리 조회해서 선택된 카드로 세팅
  useEffect(() => {
    const cardIdParam = searchParams.get("cardId");
    if (!cardIdParam) return;
    const cardId = parseCardId(cardIdParam);
    if (cardId == null) return;
    selectCardById(cardId);
  }, [searchParams]);

  // 선택된 카드/판본의 현재 시세 조회 — 가격 입력 시 참고용으로만 노출, 실패해도 등록 흐름은 막지 않는다.
  useEffect(() => {
    if (!selectedCard) return;
    let cancelled = false;
    fetchPriceSummary(selectedCard.id, selectedVariantId ?? undefined)
      .then((summary) => {
        if (!cancelled) setPriceSummary(summary);
      })
      .catch(() => {
        if (!cancelled) setPriceSummary(null);
      })
      .finally(() => {
        if (!cancelled) setPriceSummaryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCard, selectedVariantId]);

  // 카드 검색 자동완성 (디바운스)
  useEffect(() => {
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
  }, [query]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedCard) {
      setError("등록할 카드를 선택해 주세요.");
      return;
    }
    const priceNumber = Number(price);
    if (!price || !Number.isInteger(priceNumber) || priceNumber <= 0) {
      setError("가격을 올바르게 입력해 주세요.");
      return;
    }

    setSubmitting(true);
    try {
      await createListing({
        cardId: selectedCard.id,
        variantId: selectedVariantId ?? undefined,
        price: priceNumber,
        grade: grade || undefined,
      });
      router.push(`/cards/${selectedCard.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "상품 등록에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (status !== "authenticated") return null;

  const inputCls =
    "w-full rounded-[11px] border border-[#DDDDE3] px-3.5 py-3 text-[14.5px] text-ink outline-none";

  const priceNumber = Number(price);
  const buyPrice = priceSummary?.buyPrice;
  let priceOutlierWarning: string | null = null;
  if (price && Number.isInteger(priceNumber) && priceNumber > 0 && buyPrice != null && buyPrice > 0) {
    const diffRatio = (priceNumber - buyPrice) / buyPrice;
    if (diffRatio >= PRICE_OUTLIER_THRESHOLD) {
      priceOutlierWarning = "입력하신 가격이 현재 최저 시세보다 많이 높습니다. 다시 한번 확인해 주세요.";
    } else if (diffRatio <= -PRICE_OUTLIER_THRESHOLD) {
      priceOutlierWarning = "입력하신 가격이 현재 최저 시세보다 많이 낮습니다. 다시 한번 확인해 주세요.";
    }
  }

  return (
    <main className="main-content bg-neutral px-10 py-14">
      <div className="mx-auto w-full max-w-[520px] rounded-[18px] border border-[#EDEDF0] bg-white px-[34px] py-9 shadow-card">
        <h1 className="mb-6 text-[20px] font-extrabold tracking-[-0.5px]">상품 등록</h1>

        <form onSubmit={handleSubmit}>
          {/* 카드 선택 */}
          <label htmlFor="card-search" className="mb-[7px] block text-[13px] font-bold text-[#4B4B52]">
            카드
          </label>
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
                  setPriceSummary(null);
                }}
                className="flex-shrink-0 text-[12.5px] font-semibold text-[#8A8A92] hover:text-primary"
              >
                다시 선택
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                id="card-search"
                type="text"
                value={query}
                onChange={(e) => {
                  const next = e.target.value;
                  setQuery(next);
                  // 새 검색어로 갈아탈 때 이전 검색 결과가 잠깐 그대로 보이는 것을 막는다 —
                  // 디바운스가 끝나기 전까지는 목록/검색중 상태를 여기서 바로 초기화.
                  setSuggestions([]);
                  setSearching(next.trim().length >= MIN_QUERY_LENGTH);
                }}
                placeholder="카드 이름으로 검색 (2자 이상)"
                className={inputCls}
              />
              {query.trim().length >= MIN_QUERY_LENGTH && (
                <div className="absolute z-10 mt-1.5 w-full rounded-[11px] border border-[#EDEDF0] bg-white shadow-card">
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
                          <div className="truncate text-xs text-[#8A8A92]">{card.setName}</div>
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
              <div className="h-4" />
              <label className="mb-[7px] block text-[13px] font-bold text-[#4B4B52]">판본</label>
              <div className="flex flex-wrap gap-1.5">
                {selectedCard.variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      setSelectedVariantId(v.id);
                      setPriceSummaryLoading(true);
                    }}
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

          <div className="h-4" />

          {/* 가격 */}
          <div className="mb-[7px] flex items-center justify-between">
            <label htmlFor="price" className="block text-[13px] font-bold text-[#4B4B52]">
              가격
            </label>
            {selectedCard && (
              <span className="text-[12px] font-semibold text-[#8A8A92]">
                {priceSummaryLoading
                  ? "시세 조회 중..."
                  : priceSummary?.buyPrice != null
                    ? `현재 최저 시세 ${priceSummary.buyPrice.toLocaleString("ko-KR")}원`
                    : "시세 정보 없음"}
              </span>
            )}
          </div>
          {/* type="number"는 천 단위 콤마를 표시할 수 없어 text로 두고, 상태에는 숫자만 담는다
              (app/listings/me/page.tsx의 가격 수정 입력과 같은 방식). */}
          <input
            id="price"
            type="text"
            inputMode="numeric"
            value={price ? Number(price).toLocaleString("ko-KR") : ""}
            onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="판매 가격 (원)"
            className={inputCls}
          />
          {priceOutlierWarning && (
            <p className="mt-1.5 text-[12px] font-semibold text-[#C97A00]">
              {priceOutlierWarning}
            </p>
          )}

          <div className="h-4" />

          {/* 등급 */}
          <div className="mb-[7px] flex items-center gap-1.5">
            <label htmlFor="grade" className="block text-[13px] font-bold text-[#4B4B52]">
              등급 (선택)
            </label>
            <div className="group relative flex items-center">
              <span className="flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-[#EDEDF0] text-[10.5px] font-bold text-[#8A8A92]">
                ?
              </span>
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-64 -translate-x-1/2 rounded-[10px] border border-[#EDEDF0] bg-white p-3 text-[12px] leading-relaxed text-[#4B4B52] opacity-0 shadow-card transition group-hover:opacity-100">
                {GRADE_OPTIONS.map((g) => (
                  <p key={g} className="mb-1.5 last:mb-0">
                    <span className="font-bold text-ink">{g}</span> — {GRADE_GUIDE[g]}
                  </p>
                ))}
              </div>
            </div>
          </div>
          <select
            id="grade"
            value={grade}
            onChange={(e) => setGrade(e.target.value as ListingGrade | "")}
            className={inputCls}
          >
            <option value="">선택 안 함</option>
            {GRADE_OPTIONS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          {grade && (
            <p className="mt-1.5 text-[12px] leading-relaxed text-[#8A8A92]">
              {GRADE_GUIDE[grade]}
            </p>
          )}

          {error && <p className="mt-4 text-[12.5px] font-semibold text-primary">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full rounded-[11px] border-2 border-primary-dark bg-primary py-3.5 text-[15.5px] font-bold text-white shadow-tactile transition active:translate-y-0.5 active:shadow-tactile-active disabled:opacity-60"
          >
            {submitting ? "등록 중..." : "상품 등록"}
          </button>
        </form>

        {selectedCard && (
          <p className="mt-4 text-center text-[13.5px] text-[#8A8A92]">
            <Link
              href={`/cards/${selectedCard.id}`}
              className="font-bold text-primary hover:text-primary-dark"
            >
              카드 상세로 돌아가기
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
