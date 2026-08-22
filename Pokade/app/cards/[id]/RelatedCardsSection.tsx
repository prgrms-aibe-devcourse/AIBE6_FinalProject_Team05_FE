"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CardImage from "@/components/CardImage";
import { CardSearchItem, toCardSearchItem } from "@/types/card";
import { fetchRelatedCards } from "@/lib/cardApi";

type RelatedLoadState = "loading" | "ready";

// 부모(CardDetailView)가 loadState === "ready"일 때만 이 컴포넌트를 마운트하므로,
// 여기서 다시 loadState를 확인할 필요 없이 [cardId]만으로 조회하면 된다.
export default function RelatedCardsSection({ cardId }: { cardId: number }) {
  const [relatedCards, setRelatedCards] = useState<CardSearchItem[]>([]);
  const [relatedLoadState, setRelatedLoadState] = useState<RelatedLoadState>("loading");

  useEffect(() => {
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
  }, [cardId]);

  return (
    <div className="mt-8">
      <h2 className="mb-4 text-[17px] font-extrabold">비슷한 카드</h2>

      {relatedLoadState === "loading" && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[5/7] w-full animate-pulse rounded-[14px] border border-[#EDEDF0] bg-[#F2F2F5]"
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
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {relatedCards.map((rc) => (
            <Link
              key={rc.id}
              href={`/cards/${rc.id}`}
              className="flex cursor-pointer flex-col overflow-hidden rounded-[14px] border border-[#EDEDF0] transition hover:-translate-y-1 hover:shadow-lift"
            >
              <div className="relative aspect-[5/7] w-full bg-[#F2F2F5]">
                <CardImage src={rc.imageUrl} alt={rc.name} label="카드" />
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
  );
}
