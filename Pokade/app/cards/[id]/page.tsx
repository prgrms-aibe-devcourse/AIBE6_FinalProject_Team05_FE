"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import GradeBadge from "@/components/GradeBadge";
import CardImage from "@/components/CardImage";
import {
  CardDetailResponse,
  CardSearchItem,
  parseCardId,
  toCardSearchItem,
  variantLabel,
} from "@/types/card";
import {
  ListingGrade,
  ListingSummaryResponse,
  PriceSummaryResponse,
  TradeSummaryResponse,
} from "@/types/price";
import {
  fetchActiveListings,
  fetchCardDetail,
  fetchPriceSummary,
  fetchRecentTrades,
  fetchRelatedCards,
} from "@/lib/cardApi";
import { ApiError } from "@/lib/apiClient";

type LoadState = "loading" | "error" | "notfound" | "ready";
type RelatedLoadState = "loading" | "ready";

// LocalDateTime("yyyy-MM-ddTHH:mm:ss") 문자열을 "YYYY.MM.DD HH:mm"로 표시.
function formatTradedAt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 매물/체결 등급(S/A/B/PSA10/PSA9/PSA8)은 AI 등급진단의 Grade(S/A/B)보다 값 범위가 넓어
// GradeBadge를 그대로 못 쓴다 — 대신 겹치는 S/A/B는 GradeBadge와 동일한 grade-* 톤을 재사용해
// "같은 등급 개념은 같은 색"을 유지하고, 대응값이 없는 PSA10/9/8은 중립 톤으로 남겨둔다
// (PSA 등급과 S/A/B 등급 간 우열 매핑은 거래 도메인이 정할 몫이라 임의로 만들지 않음).
const LISTING_GRADE_STYLES: Partial<Record<ListingGrade, string>> = {
  S: "bg-grade-s text-grade-s-ink",
  A: "bg-grade-a text-white",
  B: "bg-grade-b text-white",
};

function ListingGradeBadge({ grade }: { grade: ListingGrade | null }) {
  const style = grade
    ? (LISTING_GRADE_STYLES[grade] ?? "bg-[#EEF0F2] text-[#4B4B52]")
    : "bg-[#EEF0F2] text-[#9A9AA2]";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold ${style}`}>
      {grade ?? "등급 미정"}
    </span>
  );
}

// cardId가 바뀔 때마다 key={id}로 리마운트시켜, 이전 카드의 상태(이미지/시세/매물/체결 등)가
// 새 카드 응답을 받기 전까지 화면에 잔존하는 것을 방지한다.
function CardDetailView({ cardId }: { cardId: number | null }) {
  const router = useRouter();

  const [card, setCard] = useState<CardDetailResponse | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);

  const [relatedCards, setRelatedCards] = useState<CardSearchItem[]>([]);
  const [relatedLoadState, setRelatedLoadState] = useState<RelatedLoadState>("loading");

  const [priceSummary, setPriceSummary] = useState<PriceSummaryResponse | null>(null);
  const [recentTrades, setRecentTrades] = useState<TradeSummaryResponse[]>([]);
  const [activeListings, setActiveListings] = useState<ListingSummaryResponse[]>([]);
  // 판본이 2개 이상인 카드에서만 채워지는 판본별 시세 비교용 상태(variantId -> summary).
  const [variantPrices, setVariantPrices] = useState<Record<number, PriceSummaryResponse | null>>(
    {},
  );
  const [variantPricesLoadState, setVariantPricesLoadState] = useState<RelatedLoadState>("loading");
  // GET /api/listings는 (summary/trades와 달리) 아직 인증이 필요해 401이 날 수 있다 —
  // "매물 없음"과 "조회 권한 없음"을 구분해서 보여주기 위한 별도 상태.
  const [listingsError, setListingsError] = useState<ApiError | null>(null);
  const [priceLoadState, setPriceLoadState] = useState<RelatedLoadState>("loading");

  // /search에서 저장해 둔 마지막 검색 URL(필터 쿼리 포함)로 돌아간다.
  // Link의 클라이언트 사이드 라우팅은 document.referrer를 갱신하지 않으므로 sessionStorage를 사용.
  const goBackToSearch = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    router.push(sessionStorage.getItem("searchBackUrl") || "/search");
  };

  useEffect(() => {
    if (cardId == null) return;
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
    if (loadState !== "ready" || cardId == null) return;
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

  useEffect(() => {
    if (loadState !== "ready" || cardId == null) return;
    let cancelled = false;

    Promise.allSettled([
      fetchPriceSummary(cardId),
      fetchRecentTrades(cardId),
      fetchActiveListings(cardId),
    ]).then(([summaryResult, tradesResult, listingsResult]) => {
      if (cancelled) return;
      setPriceSummary(summaryResult.status === "fulfilled" ? summaryResult.value : null);
      setRecentTrades(tradesResult.status === "fulfilled" ? tradesResult.value : []);
      if (listingsResult.status === "fulfilled") {
        setActiveListings(listingsResult.value);
        setListingsError(null);
      } else {
        setActiveListings([]);
        setListingsError(
          listingsResult.reason instanceof ApiError
            ? listingsResult.reason
            : new ApiError(0, "UNKNOWN", "매물 정보를 불러오지 못했습니다."),
        );
      }
      setPriceLoadState("ready");
    });

    return () => {
      cancelled = true;
    };
  }, [cardId, loadState]);

  // 판본이 여러 개인 카드만 판본별 시세 비교가 필요하므로, 판본당 summary를 병렬로 따로 조회한다.
  // (판본 1개 카드는 기존 priceSummary 조회만으로 충분해 이 effect 자체가 동작하지 않는다.)
  useEffect(() => {
    if (loadState !== "ready" || cardId == null || !card || card.variants.length <= 1) return;
    let cancelled = false;

    Promise.allSettled(card.variants.map((v) => fetchPriceSummary(cardId, v.id))).then(
      (results) => {
        if (cancelled) return;
        const next: Record<number, PriceSummaryResponse | null> = {};
        card.variants.forEach((v, i) => {
          const r = results[i];
          next[v.id] = r.status === "fulfilled" ? r.value : null;
        });
        setVariantPrices(next);
        setVariantPricesLoadState("ready");
      },
    );

    return () => {
      cancelled = true;
    };
  }, [cardId, loadState, card]);

  return (
    <main className="main-content bg-neutral px-4 pb-14 pt-8 sm:px-10">
      <div className="mx-auto max-w-[1000px]">
        <Link
          href="/search"
          onClick={goBackToSearch}
          className="mb-5 inline-block text-[13.5px] font-semibold text-[#8A8A92] hover:text-primary"
        >
          ← 카드 검색으로 돌아가기
        </Link>

        {loadState === "loading" && cardId != null && (
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

        {(loadState === "notfound" || cardId == null) && (
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
                <div className="grid grid-cols-1 gap-8 rounded-2xl border border-[#EDEDF0] bg-white p-8 md:grid-cols-[280px_1fr]">
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
                    {card.variants.length > 1 && (
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
                      {card.variants.length === 1 && (
                        <div className="flex justify-between border-b border-[#F5F5F7] pb-3">
                          <span className="text-[#8A8A92]">판본</span>
                          <span className="font-bold">
                            {variantLabel(card.variants[0].variantName)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between border-b border-[#F5F5F7] pb-3">
                        <span className="text-[#8A8A92]">아티스트</span>
                        <span className="font-bold">{card.artist || "-"}</span>
                      </div>
                      <div className="flex justify-between border-b border-[#F5F5F7] pb-3">
                        <span className="text-[#8A8A92]">인쇄번호</span>
                        <span className="font-bold">{card.printedNumber || "-"}</span>
                      </div>
                    </div>
                    {card.variants.length > 1 ? (
                      <div className="mt-auto flex flex-col gap-2 rounded-xl bg-neutral px-4 py-3.5">
                        <div className="text-[12px] font-semibold text-[#8A8A92]">
                          판본별 시세 비교
                        </div>
                        {card.variants.map((v) => {
                          const vp = variantPrices[v.id];
                          return (
                            <div
                              key={v.id}
                              className="flex items-center justify-between gap-4 rounded-lg bg-white px-3 py-2.5"
                            >
                              <span className="text-[12.5px] font-bold text-ink">
                                {variantLabel(v.variantName)}
                              </span>
                              <div className="flex items-end gap-5">
                                <div>
                                  <div className="text-[10.5px] font-semibold text-[#8A8A92]">
                                    즉시구매가
                                  </div>
                                  <div className="mt-0.5 text-right text-[15px] font-extrabold text-primary">
                                    {variantPricesLoadState === "loading" ? (
                                      <span className="text-[12.5px] font-semibold text-[#9A9AA2]">
                                        불러오는 중...
                                      </span>
                                    ) : vp?.buyPrice != null ? (
                                      `${vp.buyPrice.toLocaleString("ko-KR")}원`
                                    ) : (
                                      <span className="text-[12.5px] font-semibold text-[#9A9AA2]">
                                        매물 없음
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[10.5px] font-semibold text-[#8A8A92]">
                                    판매가
                                  </div>
                                  <div className="mt-0.5 text-right text-[13px] font-bold text-ink">
                                    {variantPricesLoadState === "loading" ? (
                                      <span className="text-[12px] font-semibold text-[#9A9AA2]">
                                        불러오는 중...
                                      </span>
                                    ) : vp?.sellPrice != null ? (
                                      `${vp.sellPrice.toLocaleString("ko-KR")}원`
                                    ) : (
                                      <span className="text-[12px] font-semibold text-[#9A9AA2]">
                                        판매 요청 없음
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-auto flex items-end justify-between gap-4 rounded-xl bg-neutral px-4 py-3.5 pt-3.5">
                        <div>
                          <div className="text-[12px] font-semibold text-[#8A8A92]">
                            즉시구매가
                          </div>
                          <div className="mt-1 text-[22px] font-extrabold text-primary">
                            {priceLoadState === "loading" ? (
                              <span className="text-[14px] font-semibold text-[#9A9AA2]">
                                불러오는 중...
                              </span>
                            ) : priceSummary?.buyPrice != null ? (
                              `${priceSummary.buyPrice.toLocaleString("ko-KR")}원`
                            ) : (
                              <span className="text-[14px] font-semibold text-[#9A9AA2]">
                                매물 없음
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[12px] font-semibold text-[#8A8A92]">판매가</div>
                          <div className="mt-1 text-[16px] font-bold text-ink">
                            {priceLoadState === "loading" ? (
                              <span className="text-[13px] font-semibold text-[#9A9AA2]">
                                불러오는 중...
                              </span>
                            ) : priceSummary?.sellPrice != null ? (
                              `${priceSummary.sellPrice.toLocaleString("ko-KR")}원`
                            ) : (
                              <span className="text-[13px] font-semibold text-[#9A9AA2]">
                                판매 요청 없음
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-8">
                  <h2 className="mb-4 text-[17px] font-extrabold">판매 중인 매물</h2>

                  {priceLoadState === "loading" && (
                    <div className="flex flex-col gap-2 rounded-2xl border border-[#EDEDF0] bg-white p-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-[60px] animate-pulse rounded-xl bg-[#F2F2F5]" />
                      ))}
                    </div>
                  )}

                  {priceLoadState === "ready" &&
                    listingsError &&
                    (listingsError.status === 401 || listingsError.status === 403 ? (
                      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-[#EDEDF0] bg-white py-12 text-center text-[13.5px] text-[#9A9AA2]">
                        <span>매물 목록은 로그인 후 확인할 수 있습니다.</span>
                        <Link
                          href="/login"
                          className="text-[13px] font-bold text-primary hover:text-primary-dark"
                        >
                          로그인하기
                        </Link>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-[#EDEDF0] bg-white py-12 text-center text-[13.5px] text-[#9A9AA2]">
                        매물 정보를 불러오지 못했습니다.
                      </div>
                    ))}

                  {priceLoadState === "ready" && !listingsError && activeListings.length === 0 && (
                    <div className="rounded-2xl border border-[#EDEDF0] bg-white py-12 text-center text-[13.5px] text-[#9A9AA2]">
                      판매 중인 매물이 없습니다.
                    </div>
                  )}

                  {priceLoadState === "ready" && !listingsError && activeListings.length > 0 && (
                    <div className="flex flex-col gap-2 rounded-2xl border border-[#EDEDF0] bg-white p-2">
                      {activeListings.map((l) => (
                        <div key={l.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                          <div className="relative h-[52px] w-[38px] shrink-0 overflow-hidden rounded-[7px] bg-[#F2F2F5]">
                            <CardImage src={l.thumbnailUrl ?? undefined} label="카드" />
                          </div>
                          <div className="flex flex-1 items-center justify-between">
                            <ListingGradeBadge grade={l.grade} />
                            <span className="text-[14px] font-extrabold text-ink">
                              {l.price.toLocaleString("ko-KR")}원
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-8">
                  <h2 className="mb-4 text-[17px] font-extrabold">최근 체결 내역</h2>

                  {priceLoadState === "loading" && (
                    <div className="flex flex-col gap-2 rounded-2xl border border-[#EDEDF0] bg-white p-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-[40px] animate-pulse rounded-xl bg-[#F2F2F5]" />
                      ))}
                    </div>
                  )}

                  {priceLoadState === "ready" && recentTrades.length === 0 && (
                    <div className="rounded-2xl border border-[#EDEDF0] bg-white py-12 text-center text-[13.5px] text-[#9A9AA2]">
                      최근 체결 내역이 없습니다.
                    </div>
                  )}

                  {priceLoadState === "ready" && recentTrades.length > 0 && (
                    <div className="overflow-hidden rounded-2xl border border-[#EDEDF0] bg-white">
                      <table className="w-full text-[13px]">
                        <thead>
                          <tr className="border-b border-[#EDEDF0] text-left text-[#8A8A92]">
                            <th className="px-4 py-2.5 font-semibold">체결일시</th>
                            <th className="px-4 py-2.5 font-semibold">등급</th>
                            <th className="px-4 py-2.5 text-right font-semibold">가격</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentTrades.map((t, i) => (
                            <tr key={i} className="border-b border-[#F5F5F7] last:border-0">
                              <td className="px-4 py-2.5 text-[#4B4B52]">
                                {formatTradedAt(t.tradedAt)}
                              </td>
                              <td className="px-4 py-2.5">
                                <ListingGradeBadge grade={t.grade} />
                              </td>
                              <td className="px-4 py-2.5 text-right font-bold text-ink">
                                {t.price.toLocaleString("ko-KR")}원
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="mt-8">
                  <h2 className="mb-4 text-[17px] font-extrabold">비슷한 카드</h2>

                  {relatedLoadState === "loading" && (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
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
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
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

export default function CardDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <CardDetailView key={id} cardId={parseCardId(id)} />;
}
