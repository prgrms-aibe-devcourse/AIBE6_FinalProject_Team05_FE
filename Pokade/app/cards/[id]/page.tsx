"use client";

import Link from "next/link";
import { usePathname, useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import CardImage from "@/components/CardImage";
import PriceChart from "@/components/PriceChart";
import ImageLightbox from "@/components/ImageLightbox";
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
  PriceStatsResponse,
  PriceSummaryResponse,
  TradeSummaryResponse,
} from "@/types/price";
import {
  fetchActiveListings,
  fetchCardDetail,
  fetchGradeChart,
  fetchPriceChart,
  fetchPriceStats,
  fetchPriceSummary,
  fetchRelatedCards,
} from "@/lib/cardApi";
import { ApiError } from "@/lib/apiClient";
import { createTrade } from "@/lib/tradeApi";
import { useUserStore } from "@/store/useUserStore";
import { loginUrlFor } from "@/lib/authRedirect";

type LoadState = "loading" | "error" | "notfound" | "ready";
type RelatedLoadState = "loading" | "ready";

type GradeKey = ListingGrade | "RAW";

// 등급별 최저가 매물 — 구매하기 버튼이 어떤 매물(listingId)을 살지 알아야 해서 가격뿐 아니라 id도 들고 있는다.
interface GradeOffer {
  listingId: number;
  price: number;
}

// PSA10 > PSA9 > PSA8 > S > A > B > 미등급 순으로 구매 박스에 노출.
const GRADE_ORDER: GradeKey[] = ["PSA10", "PSA9", "PSA8", "S", "A", "B", "RAW"];

// grade-chart 보완 대상 후보 등급 — RAW(미등급)는 ListingGrade가 아니라 제외.
const CHART_FALLBACK_GRADES: ListingGrade[] = ["PSA10", "PSA9", "PSA8", "S", "A", "B"];

// card_prices는 카드에 따라 USD/JPY로 저장돼 있어 KRW 기준 차트에 그대로 못 섞는다.
// 실시간 환율 API가 없어 고정 근사치로 환산 — card_prices 자체가 아직 목업/추정 데이터인 시기라 근사치로 충분.
const FX_TO_KRW: Record<string, number> = { KRW: 1, USD: 1400, JPY: 9 };

const CHART_PERIOD_DAYS: Record<ChartPeriod, number> = { "7d": 7, "30d": 30, "90d": 90, "180d": 180 };

// 실거래가 이 개수 미만인 등급은 점/선이 너무 빈약해서(예: 1~2개) card_prices 추정치를 대신 쓴다.
const MIN_REAL_POINTS_PER_GRADE = 6;

// card_prices의 change_1d~180d_pct와 동일한 기준 시점(일) — "지금"까지 포함. 실거래가 충분히 많은
// 등급도 이 시점들에 각각 가장 가까운 거래 1개씩만 뽑아 점을 찍는다 — 매일 거래돼도 점이
// 365개로 늘어나지 않게, 그리고 등급마다 기준 시점이 정확히 같아서 마우스오버가 항상 정확하게 맞는다.
const REFERENCE_OFFSET_DAYS = [180, 90, 30, 14, 7, 1, 0];

const GRADE_LABELS: Record<GradeKey, string> = {
  PSA10: "PSA10",
  PSA9: "PSA9",
  PSA8: "PSA8",
  S: "S",
  A: "A",
  B: "B",
  RAW: "미등급",
};

function computeGradeSummary(
  listings: ListingSummaryResponse[],
): Partial<Record<GradeKey, GradeOffer>> {
  const summary: Partial<Record<GradeKey, GradeOffer>> = {};
  for (const l of listings) {
    const key: GradeKey = l.grade ?? "RAW";
    const current = summary[key];
    if (current == null || l.price < current.price) {
      summary[key] = { listingId: l.id, price: l.price };
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
  const userStatus = useUserStore((s) => s.status);

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
  // 비로그인이거나 체결 이력이 부족해 계산할 수 없으면 null — 뱃지 자체를 숨긴다(에러 UI 없음).
  const [priceStats, setPriceStats] = useState<PriceStatsResponse | null>(null);
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
  // 즉시구매 — 한 번에 하나의 매물만 처리(동시 클릭 방지)하고, 에러는 구매 박스 안에 표시한다.
  const [buyingListingId, setBuyingListingId] = useState<number | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);
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

  // 구매 실패(특히 매물 충돌) 후에도 등급 탭/상단 즉시구매가가 이미 팔린 매물 기준으로 남는 것을
  // 막기 위해 매물·시세를 함께 재조회. 실패 시에는 이전 값을 그대로 두지 않고 "매물 없음"으로
  // 떨어지도록 null로 리셋한다(기존 priceSummary?.buyPrice == null 분기가 이를 처리).
  const refreshListingsAndPrice = async () => {
    if (cardId == null || !card) return;
    const hasSingleVariant = card.variants.length <= 1;

    const [summaryResult, listingsResult] = await Promise.allSettled([
      hasSingleVariant ? fetchPriceSummary(cardId) : Promise.resolve(null),
      fetchActiveListings(cardId),
    ]);

    setPriceSummary(summaryResult.status === "fulfilled" ? summaryResult.value : null);

    const nextListings = listingsResult.status === "fulfilled" ? listingsResult.value : [];
    setActiveListings(nextListings);
    setListingsError(
      listingsResult.status === "fulfilled"
        ? null
        : listingsResult.reason instanceof ApiError
          ? listingsResult.reason
          : new ApiError(0, "UNKNOWN", "상품 정보를 불러오지 못했습니다."),
    );

    // 방금 실패한 매물이 선택 중이던 등급의 유일한 매물이었으면, 그 등급 선택을 해제해서
    // "선택된 것처럼 보이지만 구매 불가"인 상태로 남지 않게 한다.
    const nextSummary = computeGradeSummary(nextListings);
    setSelectedGrade((prev) => (prev != null && nextSummary[prev] != null ? prev : null));
  };

  const handleBuy = async (listingId: number) => {
    if (userStatus === "loading") return; // 세션 복원 중 — 확정될 때까지 아무 것도 하지 않는다.
    if (userStatus !== "authenticated") {
      router.push(loginUrlFor(pathname, searchParams));
      return;
    }
    setBuyingListingId(listingId);
    setBuyError(null);
    try {
      const trade = await createTrade({ listingId });
      router.push(`/trade-status/${trade.id}`);
    } catch (err) {
      setBuyError(err instanceof ApiError ? err.message : "구매 요청에 실패했습니다.");
      setBuyingListingId(null);
      await refreshListingsAndPrice();
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

  // 판본이 2개 이상인 카드만 선택 상태를 ?variant= 쿼리로 반영해 공유 가능하게 한다.
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
            : new ApiError(0, "UNKNOWN", "상품 정보를 불러오지 못했습니다."),
        );
      }
      setPriceLoadState("ready");
    });

    return () => {
      cancelled = true;
    };
  }, [cardId, loadState, card]);

  // 카드 설명 박스 우측 상단 등락률 뱃지용. 로그인/체결 이력 부족 등 어떤 이유로든 실패하면
  // 조용히 숨김 처리(비슷한 카드 목록과 동일한 관용적 처리) — 별도 에러 UI를 노출하지 않는다.
  useEffect(() => {
    if (loadState !== "ready" || cardId == null) return;
    let cancelled = false;

    fetchPriceStats(cardId)
      .then((res) => {
        if (cancelled) return;
        setPriceStats(res);
      })
      .catch(() => {
        if (cancelled) return;
        setPriceStats(null);
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

  useEffect(() => {
    if (loadState !== "ready" || cardId == null) return;
    let cancelled = false;
    // 기간(chartPeriod) 탭을 바꿀 때마다 재조회 스피너를 다시 보여주기 위해 필요 —
    // "파생 상태로 대체" 조언이 적용되지 않는 비동기 페치 수명주기 표시라 의도적으로 유지.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChartLoadState("loading");

    fetchPriceChart(cardId, chartPeriod)
      .then(async (res) => {
        if (cancelled) return;

        const realTradesByGrade = new Map<ListingGrade, TradeSummaryResponse[]>();
        for (const t of res) {
          if (t.grade == null) continue;
          const list = realTradesByGrade.get(t.grade);
          if (list) list.push(t);
          else realTradesByGrade.set(t.grade, [t]);
        }
        const rawTrades = res.filter((t) => t.grade == null);

        // 실거래가 충분치 않은(5개 미만) 등급만 card_prices 추정치(grade-chart)를 받아온다.
        const gradesNeedingEstimate = CHART_FALLBACK_GRADES.filter(
          (g) => (realTradesByGrade.get(g)?.length ?? 0) < MIN_REAL_POINTS_PER_GRADE,
        );
        const estimateResults = await Promise.allSettled(
          gradesNeedingEstimate.map((grade) => fetchGradeChart(cardId, grade)),
        );
        if (cancelled) return;

        // 등급별 "원본 소스" 하나를 정한다 — 실거래가 충분하면 실거래, 부족하면 추정치로
        // 덮어쓴다. 단, 추정치 요청이 실패/빈 배열이면 부족한 실거래라도 그대로 남겨서
        // 해당 등급이 차트에서 통째로 사라지지 않게 한다.
        const sourceByGrade = new Map<GradeKey, TradeSummaryResponse[]>();
        for (const [grade, trades] of realTradesByGrade) {
          sourceByGrade.set(grade, trades);
        }
        if (rawTrades.length > 0) sourceByGrade.set("RAW", rawTrades);
        estimateResults.forEach((result, i) => {
          if (result.status !== "fulfilled" || result.value.length === 0) return;
          const grade = gradesNeedingEstimate[i];
          sourceByGrade.set(
            grade,
            result.value.map((point) => ({
              tradedAt: point.date,
              price: Math.round(point.price * (FX_TO_KRW[point.currency] ?? 1)),
              grade,
            })),
          );
        });

        // 등급마다, card_prices와 동일한 기준 시점(REFERENCE_OFFSET_DAYS)에 가장 가까운 포인트 1개씩만
        // 뽑아 리샘플링한다 — 실거래가 아주 많아도 점이 무한히 늘어나지 않고, 모든 등급이 정확히 같은
        // 시점 그리드를 공유해서 마우스오버가 항상 정확한 등급의 값을 보여준다.
        const periodDays = CHART_PERIOD_DAYS[chartPeriod];
        const relevantOffsets = REFERENCE_OFFSET_DAYS.filter((d) => d <= periodDays);
        const now = Date.now();

        const resampled: TradeSummaryResponse[] = [];
        for (const [grade, source] of sourceByGrade) {
          for (const offsetDays of relevantOffsets) {
            const targetTime = now - offsetDays * 24 * 60 * 60 * 1000;
            let nearest = source[0];
            let nearestDiff = Math.abs(new Date(nearest.tradedAt).getTime() - targetTime);
            for (const t of source) {
              const diff = Math.abs(new Date(t.tradedAt).getTime() - targetTime);
              if (diff < nearestDiff) {
                nearest = t;
                nearestDiff = diff;
              }
            }
            resampled.push({
              tradedAt: new Date(targetTime).toISOString(),
              price: nearest.price,
              grade: grade === "RAW" ? null : grade,
            });
          }
        }

        resampled.sort((a, b) => new Date(a.tradedAt).getTime() - new Date(b.tradedAt).getTime());
        setChartData(resampled);
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
            const displayName = card.nameKo ?? card.name;
            const mainImageSrc =
              selectedVariant?.imageLarge ||
              selectedVariant?.imageSmall ||
              card.imageLarge ||
              card.imageMedium;
            const gradeSummary = computeGradeSummary(activeListings);
            const selectedOffer = selectedGrade ? gradeSummary[selectedGrade] : undefined;

            return (
              <>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
                  <div className="flex flex-col gap-6">
                    <div className="relative flex gap-6 rounded-2xl border border-[#EDEDF0] bg-white p-6">
                      {priceStats &&
                        priceStats.changeRate !== 0 &&
                        (() => {
                          const isRise = priceStats.changeRate > 0;
                          const sign = isRise ? "+" : "-";
                          return (
                            <div className="absolute right-6 top-6 flex items-center gap-1.5">
                              <span className="text-[11.5px] font-semibold text-[#9A9AA2]">
                                지난주대비
                              </span>
                              <span
                                className={`rounded-full px-3.5 py-2 text-[15px] font-extrabold ${
                                  isRise
                                    ? "bg-[#FFF1F1] text-[#EE1515]"
                                    : "bg-[#EEF3FF] text-[#2D5BFF]"
                                }`}
                              >
                                {sign}
                                {Math.abs(priceStats.changeAmount).toLocaleString("ko-KR")}원 (
                                {sign}
                                {Math.abs(priceStats.changeRate).toFixed(2)}%)
                              </span>
                            </div>
                          );
                        })()}
                      <div
                        className="relative aspect-[5/7] w-[160px] shrink-0 cursor-pointer overflow-hidden rounded-xl bg-[#F2F2F5]"
                        onClick={() => setLightboxOpen(true)}
                      >
                        <CardImage src={mainImageSrc} alt={displayName} label="카드" />
                      </div>
                      <div className="flex min-w-0 flex-col justify-center">
                        <h1 className="m-0 truncate text-[23px] font-extrabold tracking-[-0.4px]">
                          {displayName}
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
                                        상품 없음
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
                            상품 없음
                          </span>
                        )}
                      </div>
                    </div>

                    {buyError && (
                      <div className="rounded-xl border border-[#F6C6C6] bg-[#FFF1F1] px-3.5 py-2.5 text-[12.5px] font-semibold text-[#C21414]">
                        {buyError}
                      </div>
                    )}

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
                            <span>등급별 상품은 로그인 후 확인할 수 있습니다.</span>
                            <Link
                              href={loginUrlFor(pathname, searchParams)}
                              className="text-[12.5px] font-bold text-primary hover:text-primary-dark"
                            >
                              로그인하기
                            </Link>
                          </div>
                        ) : (
                          <div className="rounded-xl bg-neutral py-8 text-center text-[13px] text-[#9A9AA2]">
                            상품 정보를 불러오지 못했습니다.
                          </div>
                        ))}

                      {priceLoadState === "ready" && !listingsError && (
                        <div className="grid grid-cols-2 gap-2">
                          {GRADE_ORDER.map((grade) => {
                            const offer = gradeSummary[grade];
                            const hasStock = offer != null;
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
                                  {GRADE_LABELS[grade]}
                                </span>
                                <span className="text-[11px] font-semibold text-[#8A8A92]">
                                  {hasStock
                                    ? `${offer.price.toLocaleString("ko-KR")}원`
                                    : "상품 없음"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={
                        userStatus === "loading" || !selectedOffer || buyingListingId != null
                      }
                      onClick={() => {
                        if (!selectedOffer) return;
                        handleBuy(selectedOffer.listingId);
                      }}
                      className="mt-1 w-full rounded-[11px] border-2 border-primary-dark bg-primary py-3.5 text-[15px] font-bold text-white shadow-tactile transition active:translate-y-0.5 active:shadow-tactile-active disabled:cursor-not-allowed disabled:border-[#DDDDE3] disabled:bg-neutral disabled:text-[#9A9AA2] disabled:shadow-none"
                    >
                      {userStatus === "loading"
                        ? "인증 확인 중..."
                        : buyingListingId != null
                          ? "구매 중..."
                          : selectedOffer
                            ? "구매하기"
                            : "등급을 선택하세요"}
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

                <ImageLightbox
                  isOpen={lightboxOpen}
                  onClose={() => setLightboxOpen(false)}
                  imageSrc={mainImageSrc}
                  alt={displayName}
                />
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
