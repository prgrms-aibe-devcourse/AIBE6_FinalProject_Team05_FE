"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import CardImage from "@/components/CardImage";
import GradeMarketReference from "@/components/GradeMarketReference";
import PriceInput from "@/components/PriceInput";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { fetchCardDetail, fetchCardsByKeywordPage, fetchPriceSummary } from "@/lib/cardApi";
import { getPriceStep } from "@/lib/priceStep";
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

// 입력한 입찰가가 현재 최고 구매입찰가 대비 이 비율 이상 벗어나면 참고용 경고를 보여준다 — 등록 자체는 막지 않는다.
const PRICE_OUTLIER_THRESHOLD = 0.3;

// 등급 선택 가이드 — /listings/new의 GRADE_GUIDE와 동일한 문구(판매/구매 등록 둘 다 같은 등급 기준을 쓴다).
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

export default function NewBuyOfferPage() {
  return (
    <Suspense fallback={null}>
      <NewBuyOfferForm />
    </Suspense>
  );
}

// app/listings/new/page.tsx(판매 등록)를 거의 그대로 미러링한 구매입찰 등록 폼 — 다른 점은
// (1) createBuyOffer를 호출하는 것, (2) 시세 참고 기준이 "현재 최저 시세"가 아니라 "현재 최고
// 구매입찰가"(sellPrice - PriceSummaryResponse에서 buy_offers 최고가를 뜻하는 필드)인 것뿐이다.
function NewBuyOfferForm() {
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

  const [error, setError] = useState<string | null>(null);

  const selectRequestIdRef = useRef(0);

  const selectCardById = (cardId: number, variantIdOverride?: number) => {
    const requestId = ++selectRequestIdRef.current;
    fetchCardDetail(cardId)
      .then((detail) => {
        if (selectRequestIdRef.current !== requestId) return;
        const card = toSelectedCard(detail);
        setSelectedCard(card);
        const requested =
          variantIdOverride != null
            ? card.variants.find((v) => v.id === variantIdOverride)
            : undefined;
        const primary = requested ?? card.variants.find((v) => v.primary) ?? card.variants[0];
        setSelectedVariantId(primary?.id ?? null);
        setError(null);
        setPriceSummaryLoading(true);
      })
      .catch(() => {
        if (selectRequestIdRef.current !== requestId) return;
        setError("카드 정보를 불러오지 못했습니다. 다시 선택해 주세요.");
      });
  };

  useEffect(() => {
    const cardIdParam = searchParams.get("cardId");
    if (!cardIdParam) return;
    const cardId = parseCardId(cardIdParam);
    if (cardId == null) return;

    const variantIdParam = searchParams.get("variantId");
    const variantId = variantIdParam ? Number(variantIdParam) : null;
    selectCardById(cardId, variantId != null && Number.isFinite(variantId) ? variantId : undefined);

    const gradeParam = searchParams.get("grade");
    if (gradeParam && (GRADE_OPTIONS as string[]).includes(gradeParam)) {
      // URL 진입 시 딱 한 번 초기값을 채우는 것이라 파생 상태로 대체할 수 없음(그 뒤로는 select가 값을 소유).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGrade(gradeParam as ListingGrade);
    }
  }, [searchParams]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedCard) {
      setError("입찰할 카드를 선택해 주세요.");
      return;
    }
    const priceNumber = Number(price);
    if (!price || !Number.isInteger(priceNumber) || priceNumber <= 0) {
      setError("가격을 올바르게 입력해 주세요.");
      return;
    }
    const step = getPriceStep(priceNumber);
    if (priceNumber % step !== 0) {
      setError(`가격은 ${step.toLocaleString("ko-KR")}원 단위로 입력해 주세요.`);
      return;
    }
    const topBidPrice = priceSummary?.sellPrice;
    if (topBidPrice != null && topBidPrice > 0) {
      const diffRatio = (priceNumber - topBidPrice) / topBidPrice;
      if (diffRatio >= PRICE_OUTLIER_THRESHOLD) {
        setError("입력하신 입찰가가 현재 최고 구매입찰가보다 많이 높습니다. 가격을 다시 확인해 주세요.");
        return;
      }
    }

    // 실제 등록(readyBuyOffer)은 여기서 하지 않는다 - 받는사람 정보를 받는 주문서 단계
    // (/buy-offers/new/order)로 이동해서, 그 화면에서 결제 준비→체결까지 이어간다.
    const params = new URLSearchParams({
      cardId: String(selectedCard.id),
      price: String(priceNumber),
    });
    if (selectedVariantId != null) params.set("variantId", String(selectedVariantId));
    if (grade) params.set("grade", grade);
    router.push(`/buy-offers/new/order?${params.toString()}`);
  };

  if (status !== "authenticated") return null;

  const inputCls =
    "w-full rounded-[11px] border border-[#DDDDE3] px-3.5 py-3 text-[14.5px] text-ink outline-none";

  const priceNumber = Number(price);
  // 가격 자릿수에 따라 입력 단위를 강제한다(100원대 10원 단위 ~ 10만원 단위 상한) - getPriceStep 참고.
  const priceStep =
    price && Number.isInteger(priceNumber) && priceNumber > 0 ? getPriceStep(priceNumber) : null;
  const priceStepWarning =
    priceStep != null && priceNumber % priceStep !== 0
      ? `${priceStep.toLocaleString("ko-KR")}원 단위로 입력해 주세요.`
      : null;
  const topBidPrice = priceSummary?.sellPrice;
  let priceOutlierWarning: string | null = null;
  if (
    price &&
    Number.isInteger(priceNumber) &&
    priceNumber > 0 &&
    topBidPrice != null &&
    topBidPrice > 0
  ) {
    const diffRatio = (priceNumber - topBidPrice) / topBidPrice;
    if (diffRatio >= PRICE_OUTLIER_THRESHOLD) {
      priceOutlierWarning =
        "입력하신 입찰가가 현재 최고 구매입찰가보다 많이 높습니다. 다시 한번 확인해 주세요.";
    } else if (diffRatio <= -PRICE_OUTLIER_THRESHOLD) {
      priceOutlierWarning =
        "입력하신 입찰가가 현재 최고 구매입찰가보다 많이 낮습니다. 다시 한번 확인해 주세요.";
    }
  }

  return (
    <main className="main-content bg-neutral px-10 py-14">
      <div className="mx-auto w-full max-w-[520px] rounded-[18px] border border-[#EDEDF0] bg-white px-[34px] py-9 shadow-card">
        <h1 className="mb-6 text-[20px] font-extrabold tracking-[-0.5px]">구매 입찰 등록</h1>

        <form onSubmit={handleSubmit}>
          <label
            htmlFor="card-search"
            className="mb-[7px] block text-[13px] font-bold text-[#4B4B52]"
          >
            카드
          </label>
          {selectedCard ? (
            <div className="flex items-center gap-3 rounded-[11px] border border-[#DDDDE3] px-3.5 py-3">
              <div className="relative h-14 w-10 flex-shrink-0 overflow-hidden rounded-[7px] bg-[#F2F2F5]">
                <CardImage src={selectedCard.imageUrl} alt={selectedCard.name} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14.5px] font-bold text-ink">{selectedCard.name}</div>
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

          <div className="mb-[7px] flex items-center justify-between">
            <label htmlFor="price" className="block text-[13px] font-bold text-[#4B4B52]">
              입찰가
            </label>
            {selectedCard && (
              <span className="text-[12px] font-semibold text-[#8A8A92]">
                {priceSummaryLoading
                  ? "시세 조회 중..."
                  : priceSummary?.sellPrice != null
                    ? `현재 최고 구매입찰가 ${priceSummary.sellPrice.toLocaleString("ko-KR")}원`
                    : "시세 정보 없음"}
              </span>
            )}
          </div>
          <PriceInput
            id="price"
            value={price}
            onChange={setPrice}
            placeholder="구매 입찰가 (원)"
            className={inputCls}
          />
          {priceStepWarning && (
            <p className="mt-1.5 text-[12px] font-semibold text-primary">{priceStepWarning}</p>
          )}
          {priceOutlierWarning && (
            <p className="mt-1.5 text-[12px] font-semibold text-[#C97A00]">{priceOutlierWarning}</p>
          )}

          <div className="h-4" />

          <div className="mb-[7px] flex items-center gap-1.5">
            <label htmlFor="grade" className="block text-[13px] font-bold text-[#4B4B52]">
              등급 (선택)
            </label>
            <div className="group relative flex items-center">
              <button
                type="button"
                aria-label="등급 기준 안내"
                className="flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-[#EDEDF0] text-[10.5px] font-bold text-[#8A8A92]"
              >
                ?
              </button>
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-64 -translate-x-1/2 rounded-[10px] border border-[#EDEDF0] bg-white p-3 text-[12px] leading-relaxed text-[#4B4B52] opacity-0 shadow-card transition group-hover:opacity-100 group-focus-within:opacity-100">
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
          {selectedCard && (
            <GradeMarketReference
              cardId={selectedCard.id}
              variantId={selectedVariantId}
              grade={grade}
            />
          )}

          {error && <p className="mt-4 text-[12.5px] font-semibold text-primary">{error}</p>}

          <button
            type="submit"
            className="mt-6 w-full rounded-[11px] border-2 border-primary-dark bg-primary py-3.5 text-[15.5px] font-bold text-white shadow-tactile transition active:translate-y-0.5 active:shadow-tactile-active disabled:opacity-60"
          >
            다음
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
