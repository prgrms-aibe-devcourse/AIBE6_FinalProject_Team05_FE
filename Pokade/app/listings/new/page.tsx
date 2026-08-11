"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import CardImage from "@/components/CardImage";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { ApiError } from "@/lib/apiClient";
import { createListing } from "@/lib/listingApi";
import { fetchCardDetail, fetchCardsByKeywordPage } from "@/lib/cardApi";
import {
  CardDetailResponse,
  CardResponse,
  parseCardId,
  VariantSummary,
  variantLabel,
} from "@/types/card";
import { ListingGrade } from "@/types/price";

const MIN_QUERY_LENGTH = 2;
const GRADE_OPTIONS: ListingGrade[] = ["S", "A", "B", "PSA10", "PSA9", "PSA8"];

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
      setError(err instanceof ApiError ? err.message : "매물 등록에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (status !== "authenticated") return null;

  const inputCls =
    "w-full rounded-[11px] border border-[#DDDDE3] px-3.5 py-3 text-[14.5px] text-ink outline-none";

  return (
    <main className="main-content bg-neutral px-10 py-14">
      <div className="mx-auto w-full max-w-[520px] rounded-[18px] border border-[#EDEDF0] bg-white px-[34px] py-9 shadow-card">
        <h1 className="mb-6 text-[20px] font-extrabold tracking-[-0.5px]">매물 등록</h1>

        <form onSubmit={handleSubmit}>
          {/* 카드 선택 */}
          <label className="mb-[7px] block text-[13px] font-bold text-[#4B4B52]">카드</label>
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

          <div className="h-4" />

          {/* 가격 */}
          <label htmlFor="price" className="mb-[7px] block text-[13px] font-bold text-[#4B4B52]">
            가격
          </label>
          <input
            id="price"
            type="number"
            min={1}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="판매 가격 (원)"
            className={inputCls}
          />

          <div className="h-4" />

          {/* 등급 */}
          <label htmlFor="grade" className="mb-[7px] block text-[13px] font-bold text-[#4B4B52]">
            등급 (선택)
          </label>
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

          {error && <p className="mt-4 text-[12.5px] font-semibold text-primary">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full rounded-[11px] border-2 border-primary-dark bg-primary py-3.5 text-[15.5px] font-bold text-white shadow-tactile transition active:translate-y-0.5 active:shadow-tactile-active disabled:opacity-60"
          >
            {submitting ? "등록 중..." : "매물 등록"}
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
