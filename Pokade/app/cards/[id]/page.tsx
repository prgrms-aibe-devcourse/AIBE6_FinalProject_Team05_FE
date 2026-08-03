"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import CardImage from "@/components/CardImage";
import PriceChart from "@/components/PriceChart";
import {
  CardDetailResponse,
  CardSearchItem,
  parseCardId,
  toCardSearchItem,
  variantLabel,
} from "@/types/card";
import {
  ChartPeriod,
  ListingGrade,
  ListingSummaryResponse,
  PriceSummaryResponse,
  TradeSummaryResponse,
} from "@/types/price";
import {
  fetchActiveListings,
  fetchCardDetail,
  fetchPriceChart,
  fetchPriceSummary,
  fetchRelatedCards,
} from "@/lib/cardApi";
import { ApiError } from "@/lib/apiClient";

type LoadState = "loading" | "error" | "notfound" | "ready";
type RelatedLoadState = "loading" | "ready";

type GradeKey = ListingGrade | "RAW";

// PSA10 > PSA9 > PSA8 > S > A > B 순으로 구매 박스에 노출(미등급은 구매 박스에서 제외).
const GRADE_ORDER: GradeKey[] = ["PSA10", "PSA9", "PSA8", "S", "A", "B"];

function computeGradeSummary(
  listings: ListingSummaryResponse[],
): Partial<Record<GradeKey, number>> {
  const summary: Partial<Record<GradeKey, number>> = {};
  for (const l of listings) {
    const key: GradeKey = l.grade ?? "RAW";
    const current = summary[key];
    if (current == null || l.price < current) {
      summary[key] = l.price;
    }
  }
  return summary;
}

// cardId가 바뀔 때마다 key={id}로 리마운트시켜, 이전 카드의 상태(이미지/시세/매물/체결 등)가
// 새 카드 응답을 받기 전까지 화면에 잔존하는 것을 방지한다.
function CardDetailView({ cardId }: { cardId: number | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [card, setCard] = useState<CardDetailResponse | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const [relatedCards, setRelatedCards] = useState<CardSearchItem[]>([]);
  const [relatedLoadState, setRelatedLoadState] = useState<RelatedLoadState>("loading");

  const [priceSummary, setPriceSummary] = useState<PriceSummaryResponse | null>(null);
  const [activeListings, setActiveListings] = useState<ListingSummaryResponse[]>([]);
  // 판본이 2개 이상인 카드에서만 채워지는 판본별 시세 비교용 상태(variantId -> summary).
  const [variantPrices, setVariantPrices] = useState<Record<number, PriceSummaryResponse | null>>(
    {},
  );
  const [variantPricesLoadState, setVariantPricesLoadState] = useState<RelatedLoadState>("loading");
  const [selectedGrade, setSelectedGrade] = useState<GradeKey | null>(null);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("30d");
  const [chartData, setChartData] = useState<TradeSummaryResponse[]>([]);
  const [chartLoadState, setChartLoadState] = useState<RelatedLoadState>("loading");
  const [chartError, setChartError] = useState<ApiError | null>(null);
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

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드 접근이 차단된 환경(권한 거부 등)에서는 조용히 무시.
    }
  };

  // /search에서 스크롤을 많이 내린 상태로 카드를 클릭하면, 상세 페이지가 처음
  // 커밋되는 순간(로딩 스피너, 짧은 문서 높이)에 브라우저가 scrollY를 그 문서의
  // 바닥으로 강제 클램프한다. 데이터 페칭 effect보다 먼저 실행되도록 맨 위에 둔다.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  // 라이트박스가 열려 있는 동안 배경 스크롤 방지 (/search 필터 드로어와 동일 패턴).
  useEffect(() => {
    if (!lightboxOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [lightboxOpen]);

  // ESC로 라이트박스 닫기 (/search 필터 드로어와 동일 패턴).
  useEffect(() => {
    if (!lightboxOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [lightboxOpen]);

  useEffect(() => {
    if (cardId == null) return;
    let cancelled = false;

    fetchCardDetail(cardId)
      .then((res) => {
        if (cancelled) return;
        setCard(res);
        const primary = res.variants.find((v) => v.primary);
        const defaultVariantId = primary?.id ?? res.variants[0]?.id ?? null;
        const variantParam = searchParams.get("variant");
        const parsedVariantId = variantParam !== null ? Number(variantParam) : null;
        const requestedVariantId =
          parsedVariantId != null && res.variants.some((v) => v.id === parsedVariantId)
            ? parsedVariantId
            : defaultVariantId;
        setSelectedVariantId(requestedVariantId);
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
    // searchParams는 최초 진입 시 판본 초기화에만 쓰고, 이후 판본 클릭으로 URL이
    // 바뀔 때마다 카드 상세를 다시 불러오지 않도록 deps에서 제외한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId, reloadKey]);

  // 판본이 2개 이상인 카드에서만 선택 상태를 ?variant= 쿼리로 반영해 공유 가능하게 한다.
  // 대표 판본으로 돌아오면 파라미터를 지워 기본 상태의 URL을 깔끔하게 유지한다.
  useEffect(() => {
    if (!card || card.variants.length <= 1) return;
    const defaultVariantId = card.variants.find((v) => v.primary)?.id ?? card.variants[0]?.id;
    const params = new URLSearchParams(searchParams.toString());
    if (selectedVariantId != null && selectedVariantId !== defaultVariantId) {
      params.set("variant", String(selectedVariantId));
    } else {
      params.delete("variant");
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVariantId, card]);

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
    if (loadState !== "ready" || cardId == null || !card) return;
    let cancelled = false;
    // 판본이 2개 이상인 카드는 대표 판본 가격을 아래 판본별 시세 비교 effect에서
    // fetchPriceSummary(cardId, primaryVariantId)로 이미 조회하므로(BE는 variantId 생략 시
    // 대표 판본 기준으로 응답), 여기서 fetchPriceSummary(cardId)를 중복 요청하지 않는다.
    const hasSingleVariant = card.variants.length <= 1;

    Promise.allSettled([
      hasSingleVariant ? fetchPriceSummary(cardId) : Promise.resolve(null),
      fetchActiveListings(cardId),
    ]).then(([summaryResult, listingsResult]) => {
      if (cancelled) return;
      setPriceSummary(summaryResult.status === "fulfilled" ? summaryResult.value : null);
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
  }, [cardId, loadState, card]);

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

  useEffect(() => {
    if (loadState !== "ready" || cardId == null) return;
    let cancelled = false;
    // 기간(chartPeriod) 탭을 바꿀 때마다 재조회 스피너를 다시 보여주기 위해 필요 —
    // "파생 상태로 대체" 조언이 적용되지 않는 비동기 페치 수명주기 표시라 의도적으로 유지.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChartLoadState("loading");

    fetchPriceChart(cardId, chartPeriod)
      .then((res) => {
        if (cancelled) return;
        setChartData(res);
        setChartError(null);
        setChartLoadState("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setChartData([]);
        setChartError(
          err instanceof ApiError ? err : new ApiError(0, "UNKNOWN", "차트를 불러오지 못했습니다."),
        );
        setChartLoadState("ready");
      });

    return () => {
      cancelled = true;
    };
  }, [cardId, loadState, chartPeriod]);

  return (
    <main className="main-content bg-neutral px-4 pb-14 pt-8 sm:px-10">
      <div className="mx-auto max-w-[1120px]">
        <div className="mb-5 flex items-center justify-between">
          <Link
            href="/search"
            onClick={goBackToSearch}
            className="inline-block text-[13.5px] font-semibold text-[#8A8A92] hover:text-primary"
          >
            ← 카드 검색으로 돌아가기
          </Link>
          <div className="flex items-center gap-2">
            {copied && <span className="text-[12.5px] font-bold text-primary">복사됨</span>}
            <button
              type="button"
              onClick={handleShare}
              className="rounded-[9px] border-[1.5px] border-[#DDDDE3] bg-white px-3 py-1.5 text-[12.5px] font-bold text-[#4B4B52] hover:border-primary hover:text-primary"
            >
              공유하기
            </button>
          </div>
        </div>

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
            const gradeSummary = computeGradeSummary(activeListings);

            return (
              <>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
                  <div className="flex flex-col gap-6">
                    <div className="flex gap-6 rounded-2xl border border-[#EDEDF0] bg-white p-6">
                      <div
                        className="relative aspect-[5/7] w-[160px] shrink-0 cursor-pointer overflow-hidden rounded-xl bg-[#F2F2F5]"
                        onClick={() => setLightboxOpen(true)}
                      >
                        <CardImage src={mainImageSrc} alt={card.name} label="카드" />
                      </div>
                      <div className="flex min-w-0 flex-col justify-center">
                        <h1 className="m-0 truncate text-[23px] font-extrabold tracking-[-0.4px]">
                          {card.name}
                        </h1>
                        <div className="mt-2 text-[14px] text-[#8A8A92]">
                          {card.setName} · {card.rarity}
                        </div>
                        {card.types.length > 0 && (
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
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
                                className={`rounded-full border px-2.5 py-1 text-[12px] font-bold transition ${
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
                        <div className="mt-3 text-[13px] text-[#9A9AA2]">
                          {card.artist || "-"} · No.{card.printedNumber || "-"}
                        </div>
                      </div>
                    </div>

                    {card.variants.length > 1 && (
                      <div className="flex flex-col gap-2 rounded-2xl border border-[#EDEDF0] bg-white p-5">
                        <div className="mb-1 text-[12.5px] font-bold text-ink">
                          판본별 시세 비교
                        </div>
                        {card.variants.map((v) => {
                          const vp = variantPrices[v.id];
                          return (
                            <div
                              key={v.id}
                              className="flex items-center justify-between gap-4 rounded-xl bg-neutral px-3 py-2.5"
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
                    )}

                    <PriceChart
                      data={chartData}
                      period={chartPeriod}
                      onPeriodChange={setChartPeriod}
                      loading={chartLoadState === "loading"}
                      locked={
                        chartLoadState === "ready" &&
                        (chartError?.status === 401 || chartError?.status === 403)
                      }
                    />
                  </div>

                  <div className="flex flex-col gap-4 rounded-2xl border border-[#EDEDF0] bg-white p-5 lg:sticky lg:top-8 lg:self-start">
                    <div>
                      <div className="text-[12px] font-semibold text-[#8A8A92]">즉시구매가</div>
                      <div className="mt-1 text-[24px] font-extrabold text-primary">
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

                    <div className="border-t border-[#F5F5F7] pt-4">
                      <div className="mb-2.5 text-[12.5px] font-bold text-ink">등급 선택</div>

                      {priceLoadState === "loading" && (
                        <div className="grid grid-cols-2 gap-2">
                          {Array.from({ length: 6 }).map((_, i) => (
                            <div
                              key={i}
                              className="h-[52px] animate-pulse rounded-xl bg-[#F2F2F5]"
                            />
                          ))}
                        </div>
                      )}

                      {priceLoadState === "ready" &&
                        listingsError &&
                        (listingsError.status === 401 || listingsError.status === 403 ? (
                          <div className="flex flex-col items-center gap-2 rounded-xl bg-neutral py-8 text-center text-[13px] text-[#9A9AA2]">
                            <span>등급별 매물은 로그인 후 확인할 수 있습니다.</span>
                            <Link
                              href="/login"
                              className="text-[12.5px] font-bold text-primary hover:text-primary-dark"
                            >
                              로그인하기
                            </Link>
                          </div>
                        ) : (
                          <div className="rounded-xl bg-neutral py-8 text-center text-[13px] text-[#9A9AA2]">
                            매물 정보를 불러오지 못했습니다.
                          </div>
                        ))}

                      {priceLoadState === "ready" && !listingsError && (
                        <div className="grid grid-cols-2 gap-2">
                          {GRADE_ORDER.map((grade) => {
                            const price = gradeSummary[grade];
                            const hasStock = price != null;
                            const isSelected = selectedGrade === grade;
                            return (
                              <button
                                key={grade}
                                type="button"
                                disabled={!hasStock}
                                onClick={() => setSelectedGrade(grade)}
                                className={`flex flex-col items-center gap-0.5 rounded-xl border px-2 py-2.5 transition ${
                                  isSelected
                                    ? "border-primary bg-lavender"
                                    : hasStock
                                      ? "border-[#DDDDE3] bg-white hover:border-primary"
                                      : "cursor-not-allowed border-[#EDEDF0] bg-neutral opacity-50"
                                }`}
                              >
                                <span className="text-[12px] font-extrabold text-ink">
                                  {grade}
                                </span>
                                <span className="text-[11px] font-semibold text-[#8A8A92]">
                                  {hasStock ? `${price.toLocaleString("ko-KR")}원` : "매물 없음"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled
                      className="mt-1 w-full cursor-not-allowed rounded-[11px] border-2 border-[#DDDDE3] bg-neutral py-3.5 text-[15px] font-bold text-[#9A9AA2]"
                    >
                      구매하기 (준비 중)
                    </button>
                  </div>
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

                {lightboxOpen && (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
                    onClick={() => setLightboxOpen(false)}
                    role="dialog"
                    aria-modal="true"
                    aria-label="카드 이미지 확대"
                  >
                    <button
                      type="button"
                      onClick={() => setLightboxOpen(false)}
                      aria-label="닫기"
                      className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[18px] font-bold text-ink hover:bg-white"
                    >
                      ×
                    </button>
                    {mainImageSrc && (
                      <Image
                        src={mainImageSrc}
                        alt={card.name}
                        width={500}
                        height={700}
                        sizes="90vw"
                        onClick={(e) => e.stopPropagation()}
                        className="h-auto w-auto max-h-[90vh] max-w-[90vw] rounded-2xl object-contain"
                      />
                    )}
                  </div>
                )}
              </>
            );
          })()}
      </div>
    </main>
  );
}

export default function CardDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <Suspense fallback={null}>
      <CardDetailView key={id} cardId={parseCardId(id)} />
    </Suspense>
  );
}
