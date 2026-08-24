"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import CardImage from "@/components/CardImage";
import GradeMarketReference from "@/components/GradeMarketReference";
import PriceInput from "@/components/PriceInput";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import {
  fetchCardDetail,
  fetchCardsByKeywordPage,
  fetchPriceSummaries,
  fetchPriceSummary,
} from "@/lib/cardApi";
import { getPriceStep } from "@/lib/priceStep";
import {
  CardDetailResponse,
  CardResponse,
  parseCardId,
  VariantSummary,
  variantLabel,
} from "@/types/card";
import { CardPriceSummaryResponse, ListingGrade, PriceSummaryResponse } from "@/types/price";

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

  // 등급별 최저 시세(grade 선택 시에만 조회) - 등급 없이 조회하면 다른 등급(특히 낮은 등급)의
  // 최저가가 섞여 나와, PSA10처럼 시세가 높은 등급을 등록할 때 기준 가격이 실제와 크게 어긋난다.
  const [gradePriceSummary, setGradePriceSummary] = useState<CardPriceSummaryResponse | null>(null);
  const [gradePriceSummaryLoading, setGradePriceSummaryLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // 진행 중인 카드 상세 조회 중 가장 마지막 요청만 상태에 반영하기 위한 순번 —
  // 먼저 보낸 요청(예: ?cardId= 진입)이 나중에 끝나 검색으로 새로 고른 카드를 덮어쓰는 것을 방지.
  const selectRequestIdRef = useRef(0);

  // 카드 상세(판본 목록 포함)를 조회해서 선택된 카드로 세팅 — variantIdOverride가 그 카드의 실제
  // 판본이면 그걸 선택하고, 아니면(또는 생략 시) 대표 판본을 기본 선택.
  const selectCardById = (cardId: number, variantIdOverride?: number) => {
    const requestId = ++selectRequestIdRef.current;
    fetchCardDetail(cardId)
      .then((detail) => {
        if (selectRequestIdRef.current !== requestId) return; // 그 사이 다른 카드가 선택됨 — 무시
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

  // ?cardId=&variantId=&grade= 로 진입했으면(카드 상세의 등급 선택에서 넘어온 경우) 카드/판본/등급을
  // 미리 채운다. variantId/grade는 카드 상세 쪽에서만 붙여주는 선택적 파라미터라 없어도 그대로 동작한다.
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

  // 등급을 선택하면 그 등급 기준 최저 시세를 별도로 조회 - 등급 선택 전에는 보여줄 등급 기준이
  // 없으므로 위 priceSummary(등급 무관 전체 최저가)를 그대로 참고용으로 쓴다.
  useEffect(() => {
    // grade가 없을 때는 렌더링 쪽에서 이 값을 읽지 않으므로(등급 무관 priceSummary로 대체),
    // 굳이 null로 지우지 않고 조회 자체를 건너뛴다.
    if (!selectedCard || !grade) return;
    let cancelled = false;
    // 등급을 바꿀 때마다 조회 중 상태를 다시 보여주기 위해 필요 - GradeMarketReference와 동일한 이유.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGradePriceSummaryLoading(true);
    // includeRecentTradePrice: 그 등급으로 걸린 활성 매물이 하나도 없어도(buyPrice=null) 최근
    // 체결가라도 최소한의 참고 지표로 보여주기 위해 함께 요청한다.
    fetchPriceSummaries([selectedCard.id], { grade, includeRecentTradePrice: true })
      .then((summaries) => {
        if (!cancelled) setGradePriceSummary(summaries.get(selectedCard.id) ?? null);
      })
      .catch(() => {
        if (!cancelled) setGradePriceSummary(null);
      })
      .finally(() => {
        if (!cancelled) setGradePriceSummaryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCard, grade]);

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

  const handleSubmit = (e: React.FormEvent) => {
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
    const step = getPriceStep(priceNumber);
    if (priceNumber % step !== 0) {
      setError(`가격은 ${step.toLocaleString("ko-KR")}원 단위로 입력해 주세요.`);
      return;
    }
    if (!grade) {
      setError("등급을 선택해 주세요.");
      return;
    }
    // grade는 위에서 이미 필수 검증됐으므로, 등급 무관 전체가(priceSummary)로는 다시 떨어지지
    // 않는다 - 그러면 등급별 기준을 적용하는 원래 목적이 무의미해진다.
    const referenceBuyPrice = gradePriceSummary?.buyPrice ?? gradePriceSummary?.recentTradePrice;
    if (referenceBuyPrice != null && referenceBuyPrice > 0) {
      const diffRatio = (priceNumber - referenceBuyPrice) / referenceBuyPrice;
      if (diffRatio >= PRICE_OUTLIER_THRESHOLD) {
        setError("입력하신 가격이 현재 최저 시세보다 많이 높습니다. 가격을 다시 확인해 주세요.");
        return;
      }
    }

    // 실제 등록(createListing)은 여기서 하지 않는다 - 정산계좌/반송주소를 받는 주문서
    // 단계(/listings/new/order)로 이동해서, 그 화면에서 최종 제출한다.
    const params = new URLSearchParams({
      cardId: String(selectedCard.id),
      price: String(priceNumber),
      grade,
    });
    if (selectedVariantId != null) params.set("variantId", String(selectedVariantId));
    router.push(`/listings/new/order?${params.toString()}`);
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
  // 등급을 선택했으면 그 등급 기준으로 삼는다 - 활성 매물이 있으면 최저가, 없으면(buyPrice=null)
  // 최근 체결가라도 최소한의 참고 지표로 보여준다. 등급 선택 전에는 등급 무관 전체 최저가를 쓴다.
  const gradeReferenceIsRecentTrade =
    !!grade && gradePriceSummary?.buyPrice == null && gradePriceSummary?.recentTradePrice != null;
  const referenceBuyPrice = grade
    ? gradePriceSummary?.buyPrice ?? gradePriceSummary?.recentTradePrice
    : priceSummary?.buyPrice;
  const referencePriceLoading = grade ? gradePriceSummaryLoading : priceSummaryLoading;
  const referenceLabel = grade
    ? gradeReferenceIsRecentTrade
      ? `${grade} 등급 최근 체결가`
      : `현재 ${grade} 등급 최저 시세`
    : "현재 최저 시세";
  let priceOutlierWarning: string | null = null;
  if (
    price &&
    Number.isInteger(priceNumber) &&
    priceNumber > 0 &&
    referenceBuyPrice != null &&
    referenceBuyPrice > 0
  ) {
    const diffRatio = (priceNumber - referenceBuyPrice) / referenceBuyPrice;
    if (diffRatio >= PRICE_OUTLIER_THRESHOLD) {
      priceOutlierWarning =
        "입력하신 가격이 현재 최저 시세보다 많이 높습니다. 다시 한번 확인해 주세요.";
    } else if (diffRatio <= -PRICE_OUTLIER_THRESHOLD) {
      priceOutlierWarning =
        "입력하신 가격이 현재 최저 시세보다 많이 낮습니다. 다시 한번 확인해 주세요.";
    }
  }

  return (
    <main className="main-content bg-neutral px-4 py-14 sm:px-10">
      <div className="mx-auto w-full max-w-[880px]">
        <h1 className="mb-1.5 text-[22px] font-extrabold tracking-[-0.5px]">상품 등록</h1>
        <p className="mb-7 text-[13.5px] text-[#8A8A92]">
          카드를 선택하고 가격과 등급을 입력하면, 다음 단계에서 정산 계좌를 등록해 판매를 시작할 수
          있어요.
        </p>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr] lg:items-start">
          {/* 좌측: 카드 미리보기 */}
          <div className="rounded-[18px] border border-[#EDEDF0] bg-white p-6 lg:sticky lg:top-8">
            {selectedCard ? (
              <>
                <div className="relative mx-auto aspect-[5/7] w-full max-w-[200px] overflow-hidden rounded-[13px] bg-[#F2F2F5]">
                  <CardImage src={selectedCard.imageUrl} alt={selectedCard.name} />
                </div>
                <div className="mt-4 text-center">
                  <div className="text-[15.5px] font-extrabold text-ink">{selectedCard.name}</div>
                  <div className="mt-1 text-[13px] text-[#8A8A92]">{selectedCard.setName}</div>
                </div>
                <div className="my-4 h-px bg-[#EDEDF0]" />
                <div className="text-center">
                  <div className="text-[11.5px] font-semibold text-[#8A8A92]">{referenceLabel}</div>
                  <div className="mt-1 text-[17px] font-extrabold text-primary">
                    {referencePriceLoading
                      ? "조회 중..."
                      : referenceBuyPrice != null
                        ? `${referenceBuyPrice.toLocaleString("ko-KR")}원`
                        : "정보 없음"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCard(null);
                    setSelectedVariantId(null);
                    setPriceSummary(null);
                  }}
                  className="mt-4 w-full rounded-[10px] border border-[#DDDDE3] py-2 text-[12.5px] font-semibold text-[#4B4B52] hover:border-primary hover:text-primary"
                >
                  다른 카드 선택
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center py-6 text-center">
                <div className="flex aspect-[5/7] w-full max-w-[160px] items-center justify-center rounded-[13px] bg-[#F2F2F5]">
                  <svg
                    width="34"
                    height="34"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#C7C7CE"
                    strokeWidth="1.6"
                    aria-hidden="true"
                  >
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <path d="M3 15l4.5-4.5a1.5 1.5 0 0 1 2.12 0L13 13.9l2.5-2.5a1.5 1.5 0 0 1 2.12 0L21 15" />
                  </svg>
                </div>
                <p className="mt-4 text-[12.5px] leading-relaxed text-[#9A9AA2]">
                  오른쪽에서 카드를 검색해서
                  <br />
                  선택해 주세요.
                </p>
              </div>
            )}
          </div>

          {/* 우측: 입력 폼 */}
          <div className="rounded-[18px] border border-[#EDEDF0] bg-white px-[30px] py-8 shadow-card">
            <form onSubmit={handleSubmit}>
              {!selectedCard && (
                <>
                  <label
                    htmlFor="card-search"
                    className="mb-[7px] block text-[13px] font-bold text-[#4B4B52]"
                  >
                    카드 검색
                  </label>
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
                      autoFocus
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
                </>
              )}

              {selectedCard && (
                <>
                  {selectedCard.variants.length > 1 && (
                    <>
                      <label className="mb-[7px] block text-[13px] font-bold text-[#4B4B52]">
                        판본
                      </label>
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
                      <div className="h-5" />
                    </>
                  )}

                  {/* 가격 */}
                  <div className="mb-[7px] flex items-center justify-between">
                    <label htmlFor="price" className="block text-[13px] font-bold text-[#4B4B52]">
                      가격
                    </label>
                    <span className="text-[12px] font-semibold text-[#8A8A92]">
                      {referencePriceLoading
                        ? "시세 조회 중..."
                        : referenceBuyPrice != null
                          ? `${referenceLabel} ${referenceBuyPrice.toLocaleString("ko-KR")}원`
                          : "시세 정보 없음"}
                    </span>
                  </div>
                  <PriceInput
                    id="price"
                    value={price}
                    onChange={setPrice}
                    placeholder="판매 가격 (원)"
                    className={inputCls}
                  />
                  {priceStepWarning && (
                    <p className="mt-1.5 text-[12px] font-semibold text-primary">
                      {priceStepWarning}
                    </p>
                  )}
                  {priceOutlierWarning && (
                    <p className="mt-1.5 text-[12px] font-semibold text-[#C97A00]">
                      {priceOutlierWarning}
                    </p>
                  )}

                  <div className="h-5" />

                  {/* 등급 */}
                  <div className="mb-[7px] flex items-center gap-1.5">
                    <label htmlFor="grade" className="block text-[13px] font-bold text-[#4B4B52]">
                      등급
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
                    <option value="" disabled>
                      등급을 선택해 주세요
                    </option>
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
                  <GradeMarketReference
                    cardId={selectedCard.id}
                    variantId={selectedVariantId}
                    grade={grade}
                  />

                  {error && (
                    <p className="mt-4 text-[12.5px] font-semibold text-primary">{error}</p>
                  )}

                  <button
                    type="submit"
                    className="mt-6 w-full rounded-[11px] border-2 border-primary-dark bg-primary py-3.5 text-[15.5px] font-bold text-white shadow-tactile transition active:translate-y-0.5 active:shadow-tactile-active disabled:opacity-60"
                  >
                    다음
                  </button>
                </>
              )}

              {!selectedCard && error && (
                <p className="mt-4 text-[12.5px] font-semibold text-primary">{error}</p>
              )}
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
        </div>
      </div>
    </main>
  );
}
