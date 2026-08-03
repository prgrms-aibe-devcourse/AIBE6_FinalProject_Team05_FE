"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import CardImage from "@/components/CardImage";
import { useUserStore } from "@/store/useUserStore";
import { ApiError } from "@/lib/apiClient";
import { createListing } from "@/lib/listingApi";
import { fetchCardDetail, fetchCardsByKeywordPage } from "@/lib/cardApi";
import { CardResponse, parseCardId } from "@/types/card";
import { ListingGrade } from "@/types/price";

const MIN_QUERY_LENGTH = 2;
const GRADE_OPTIONS: ListingGrade[] = ["S", "A", "B", "PSA10", "PSA9", "PSA8"];

interface SelectedCard {
  id: number;
  name: string;
  setName: string;
  imageUrl: string;
}

function toSelectedCard(card: CardResponse): SelectedCard {
  return {
    id: card.id,
    name: card.name,
    setName: card.setName,
    imageUrl: card.imageMedium || card.imageSmall,
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
  const status = useUserStore((s) => s.status);

  const [selectedCard, setSelectedCard] = useState<SelectedCard | null>(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<CardResponse[]>([]);
  const [searching, setSearching] = useState(false);

  const [price, setPrice] = useState("");
  const [grade, setGrade] = useState<ListingGrade | "">("");
  const [imageUrls, setImageUrls] = useState<string[]>([""]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 로그인 안 되어 있으면 로그인 페이지로 리다이렉트
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  // ?cardId= 로 진입했으면 카드 상세를 미리 조회해서 선택된 카드로 세팅
  useEffect(() => {
    const cardIdParam = searchParams.get("cardId");
    if (!cardIdParam) return;
    const cardId = parseCardId(cardIdParam);
    if (cardId == null) return;
    fetchCardDetail(cardId)
      .then((detail) =>
        setSelectedCard({
          id: detail.id,
          name: detail.name,
          setName: detail.setName,
          imageUrl: detail.imageMedium || detail.imageSmall,
        }),
      )
      .catch(() => {
        // 카드 조회 실패 시 검색으로 직접 고르게 둔다
      });
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

  const handleAddImageUrl = () => setImageUrls((urls) => [...urls, ""]);
  const handleRemoveImageUrl = (index: number) =>
    setImageUrls((urls) => urls.filter((_, i) => i !== index));
  const handleImageUrlChange = (index: number, value: string) =>
    setImageUrls((urls) => urls.map((u, i) => (i === index ? value : u)));

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
    const trimmedUrls = imageUrls.map((u) => u.trim()).filter((u) => u.length > 0);
    if (trimmedUrls.length === 0) {
      setError("사진 URL을 최소 1개 이상 입력해 주세요.");
      return;
    }

    setSubmitting(true);
    try {
      await createListing({
        cardId: selectedCard.id,
        price: priceNumber,
        grade: grade || undefined,
        imageUrls: trimmedUrls,
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
                onClick={() => setSelectedCard(null)}
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
                onChange={(e) => setQuery(e.target.value)}
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
                          setSelectedCard(toSelectedCard(card));
                          setQuery("");
                          setSuggestions([]);
                        }}
                        className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-neutral"
                      >
                        <div className="relative h-11 w-8 flex-shrink-0 overflow-hidden rounded-[7px] bg-[#F2F2F5]">
                          <CardImage src={card.imageMedium || card.imageSmall} alt={card.name} />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-[13.5px] font-bold text-ink">
                            {card.name}
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

          <div className="h-4" />

          {/* 사진 URL */}
          <label className="mb-[7px] block text-[13px] font-bold text-[#4B4B52]">
            사진 URL (최소 1개)
          </label>
          <div className="flex flex-col gap-2.5">
            {imageUrls.map((url, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => handleImageUrlChange(i, e.target.value)}
                  placeholder="https://example.com/image.png"
                  className={inputCls}
                />
                {imageUrls.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveImageUrl(i)}
                    className="flex-shrink-0 rounded-[11px] border border-[#DDDDE3] px-3 text-[13px] font-semibold text-[#8A8A92] hover:text-primary"
                  >
                    삭제
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleAddImageUrl}
            className="mt-2 text-[12.5px] font-semibold text-[#8A8A92] hover:text-primary"
          >
            + 사진 URL 추가
          </button>

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
