"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import GradeBadge from "@/components/GradeBadge";
import CardImage from "@/components/CardImage";
import { CardDetailResponse, CardSearchItem, toCardSearchItem, variantLabel } from "@/types/card";
import { fetchCardDetail, fetchRelatedCards } from "@/lib/cardApi";
import { ApiError } from "@/lib/apiClient";

type LoadState = "loading" | "error" | "notfound" | "ready";
type RelatedLoadState = "loading" | "ready";

export default function CardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const cardId = Number(id);

  const [card, setCard] = useState<CardDetailResponse | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);

  const [relatedCards, setRelatedCards] = useState<CardSearchItem[]>([]);
  const [relatedLoadState, setRelatedLoadState] = useState<RelatedLoadState>("loading");

  useEffect(() => {
    let cancelled = false;

    fetchCardDetail(cardId)
      .then((res) => {
        if (cancelled) return;
        setCard(res);
        const primary = res.variants.find((v) => v.primary);
        setSelectedVariantId(primary?.id ?? res.variants[0]?.id ?? null);
        setLoadState("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setLoadState("notfound");
          return;
        }
        setErrorMessage(err instanceof ApiError ? err.message : "카드 정보를 불러오지 못했습니다.");
        setLoadState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [cardId, reloadKey]);

  useEffect(() => {
    if (loadState !== "ready") return;
    let cancelled = false;

    fetchRelatedCards(cardId)
      .then((res) => {
        if (cancelled) return;
        setRelatedCards(res.map(toCardSearchItem));
        setRelatedLoadState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setRelatedCards([]);
        setRelatedLoadState("ready");
      });

    return () => {
      cancelled = true;
    };
  }, [cardId, loadState]);

  return (
    <main className="main-content bg-neutral px-10 pb-14 pt-8">
      <div className="mx-auto max-w-[1000px]">
        <Link
          href="/search"
          className="mb-5 inline-block text-[13.5px] font-semibold text-[#8A8A92] hover:text-primary"
        >
          ← 카드 검색으로 돌아가기
        </Link>

        {loadState === "loading" && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[#EDEDF0] bg-white py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#E7E7EB] border-t-primary" />
            <span className="text-[13.5px] font-semibold text-[#8A8A92]">
              카드 정보를 불러오는 중입니다...
            </span>
          </div>
        )}

        {loadState === "error" && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[#EDEDF0] bg-white py-24">
            <span className="text-[13.5px] font-bold text-[#D14343]">{errorMessage}</span>
            <button
              onClick={() => {
                setLoadState("loading");
                setReloadKey((k) => k + 1);
              }}
              className="mt-1 rounded-[9px] border-[1.5px] border-[#DDDDE3] bg-white px-4 py-2 text-[13px] font-bold text-[#4B4B52] hover:border-primary hover:text-primary"
            >
              다시 시도
            </button>
          </div>
        )}

        {loadState === "notfound" && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[#EDEDF0] bg-white py-24">
            <span className="text-[15px] font-bold text-ink">카드를 찾을 수 없습니다.</span>
            <span className="text-[13px] text-[#9A9AA2]">
              삭제되었거나 잘못된 주소일 수 있습니다.
            </span>
            <Link
              href="/search"
              className="mt-1 rounded-[9px] border-[1.5px] border-[#DDDDE3] bg-white px-4 py-2 text-[13px] font-bold text-[#4B4B52] hover:border-primary hover:text-primary"
            >
              카드 검색으로 이동
            </Link>
          </div>
        )}

        {loadState === "ready" &&
          card &&
          (() => {
            const selectedVariant = card.variants.find((v) => v.id === selectedVariantId) ?? null;
            const mainImageSrc =
              selectedVariant?.imageLarge ||
              selectedVariant?.imageSmall ||
              card.imageLarge ||
              card.imageMedium;

            return (
              <>
                <div className="grid grid-cols-[280px_1fr] gap-8 rounded-2xl border border-[#EDEDF0] bg-white p-8">
                  <div className="relative aspect-[5/7] w-full overflow-hidden rounded-2xl bg-[#F2F2F5]">
                    <CardImage src={mainImageSrc} alt={card.name} label="카드" />
                    {card.grade && (
                      <GradeBadge grade={card.grade} className="absolute left-3 top-3" />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.6px]">
                      {card.name}
                    </h1>
                    <div className="mt-2 text-[14px] text-[#8A8A92]">
                      {card.setName} · {card.rarity}
                    </div>
                    {card.types.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {card.types.map((t) => (
                          <span
                            key={t}
                            className="rounded-full border border-[#D4D9F5] bg-lavender px-2.5 py-1 text-[11.5px] font-bold text-secondary"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {card.variants.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {card.variants.map((v) => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => setSelectedVariantId(v.id)}
                            className={`rounded-full border px-2.5 py-1 text-[11.5px] font-bold transition ${
                              selectedVariantId === v.id
                                ? "border-primary bg-primary text-white"
                                : "border-[#DDDDE3] bg-white text-[#4B4B52] hover:border-primary hover:text-primary"
                            }`}
                          >
                            {variantLabel(v.variantName)}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="mt-6 flex flex-col gap-3 text-[13.5px]">
                      <div className="flex justify-between border-b border-[#F5F5F7] pb-3">
                        <span className="text-[#8A8A92]">아티스트</span>
                        <span className="font-bold">{card.artist || "-"}</span>
                      </div>
                      <div className="flex justify-between border-b border-[#F5F5F7] pb-3">
                        <span className="text-[#8A8A92]">인쇄번호</span>
                        <span className="font-bold">{card.printedNumber || "-"}</span>
                      </div>
                    </div>
                    <div className="mt-auto pt-6 text-[15px]">
                      <span className="text-[13px] font-semibold text-[#9A9AA2]">
                        가격 정보 준비중
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <h2 className="mb-4 text-[17px] font-extrabold">비슷한 카드</h2>

                  {relatedLoadState === "loading" && (
                    <div className="grid grid-cols-5 gap-4">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-[190px] animate-pulse rounded-[13px] border border-[#EDEDF0] bg-[#F2F2F5]"
                        />
                      ))}
                    </div>
                  )}

                  {relatedLoadState === "ready" && relatedCards.length === 0 && (
                    <div className="rounded-2xl border border-[#EDEDF0] bg-white py-12 text-center text-[13.5px] text-[#9A9AA2]">
                      비슷한 카드가 없습니다.
                    </div>
                  )}

                  {relatedLoadState === "ready" && relatedCards.length > 0 && (
                    <div className="grid grid-cols-5 gap-4">
                      {relatedCards.map((rc) => (
                        <Link
                          key={rc.id}
                          href={`/cards/${rc.id}`}
                          className="flex cursor-pointer flex-col overflow-hidden rounded-[13px] border border-[#EDEDF0] transition hover:-translate-y-[3px] hover:shadow-lift"
                        >
                          <div className="relative h-[140px] bg-[#F2F2F5]">
                            <CardImage
                              src={rc.imageUrl}
                              alt={rc.name}
                              label="카드"
                              className="object-top"
                            />
                            {rc.grade && (
                              <GradeBadge
                                grade={rc.grade}
                                size="sm"
                                className="absolute left-[9px] top-[9px]"
                              />
                            )}
                          </div>
                          <div className="flex flex-1 flex-col p-3">
                            <div className="text-[13px] font-bold">{rc.name}</div>
                            <div className="mt-0.5 text-[11px] text-[#9A9AA2]">{rc.set}</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </>
            );
          })()}
      </div>
    </main>
  );
}
