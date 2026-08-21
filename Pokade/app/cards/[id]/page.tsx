"use client";

import Link from "next/link";
import { usePathname, useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import CardImage from "@/components/CardImage";
import PriceChart from "@/components/PriceChart";
import ImageLightbox from "@/components/ImageLightbox";
import AddWatchlistModal from "@/components/AddWatchlistModal";
import RelatedCardsSection from "./RelatedCardsSection";
import VariantPriceComparison from "./VariantPriceComparison";
import OrderActivitySection from "./OrderActivitySection";
import GradeGuideModal from "./GradeGuideModal";
import { CardDetailResponse, parseCardId, variantLabel } from "@/types/card";
import {
  BuyOfferOrderbookEntryResponse,
  ChartPeriod,
  GRADE_LABELS,
  GRADE_ORDER,
  GradeKey,
  ListingGrade,
  ListingSummaryResponse,
  PriceStatsResponse,
  PriceSummaryResponse,
  TradeSummaryResponse,
} from "@/types/price";
import {
  fetchActiveListings,
  fetchBuyOfferOrderbook,
  fetchCardDetail,
  fetchGradeChart,
  fetchPriceChart,
  fetchPriceStats,
  fetchPriceSummary,
} from "@/lib/cardApi";
import { ApiError } from "@/lib/apiClient";
import { useUserStore } from "@/store/useUserStore";
import { loginUrlFor } from "@/lib/authRedirect";
import { toKrw } from "@/lib/currency";
import { useTimedFlag } from "@/hooks/useTimedFlag";

type LoadState = "loading" | "error" | "notfound" | "ready";
type RelatedLoadState = "loading" | "ready";

// 등급별 최저가 매물 — 구매하기 버튼이 어떤 매물(listingId)을 살지 알아야 해서 가격뿐 아니라 id도 들고 있는다.
interface GradeOffer {
  listingId: number;
  price: number;
}

// grade-chart 보완 대상 후보 등급 — RAW(미등급)는 ListingGrade가 아니라 제외.
const CHART_FALLBACK_GRADES: ListingGrade[] = ["PSA10", "PSA9", "PSA8", "S", "A", "B"];

const CHART_PERIOD_DAYS: Record<ChartPeriod, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "180d": 180,
};

// 실거래가 이 개수 미만인 등급은 점/선이 너무 빈약해서(예: 1~2개) card_prices 추정치를 대신 쓴다.
const MIN_REAL_POINTS_PER_GRADE = 6;

// card_prices의 change_1d~180d_pct와 동일한 기준 시점(일) — "지금"까지 포함. 실거래가 충분히 많은
// 등급도 이 시점들에 각각 가장 가까운 거래 1개씩만 뽑아 점을 찍는다 — 매일 거래돼도 점이
// 365개로 늘어나지 않게, 그리고 등급마다 기준 시점이 정확히 같아서 마우스오버가 항상 정확하게 맞는다.
const REFERENCE_OFFSET_DAYS = [180, 90, 30, 14, 7, 1, 0];

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

// 등급별 최고가 구매입찰 — 판매 모드일 때 등급 그리드에 "이 등급을 지금 팔면 대략 얼마 받을 수
// 있는지" 참고용으로 보여준다(가격 자체가 아니라 시세 힌트라 listingId 같은 매칭 대상은 필요 없음).
function computeBuyOfferSummary(
  buyOffers: BuyOfferOrderbookEntryResponse[],
): Partial<Record<GradeKey, number>> {
  const summary: Partial<Record<GradeKey, number>> = {};
  for (const o of buyOffers) {
    const key: GradeKey = o.grade ?? "RAW";
    const current = summary[key];
    if (current == null || o.price > current) {
      summary[key] = o.price;
    }
  }
  return summary;
}

// 선택된 변형(없으면 카드 대표 이미지)의 대표 이미지 — 구매 흐름(handleBuy)과 본문 렌더링에서 공유.
function resolveMainImageSrc(
  card: CardDetailResponse,
  variantId: number | null,
): string | undefined {
  const selectedVariant = card.variants.find((v) => v.id === variantId) ?? null;
  return (
    selectedVariant?.imageLarge ||
    selectedVariant?.imageSmall ||
    card.imageLarge ||
    card.imageMedium
  );
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
  const [copied, triggerCopied] = useTimedFlag(2000);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [watchlistModalOpen, setWatchlistModalOpen] = useState(false);
  const [watchlistAdded, triggerWatchlistAdded] = useTimedFlag(2000);
  // 등급 선택에서 "판매"/"구매입찰 등록"을 누르면 등급 안내 모달을 먼저 보여주고, 확인 시 이
  // target에 맞는 등록 페이지로 이동한다. 모달 자체는 어디로 갈지 모르므로 여기서 target을 들고 있는다.
  const [gradeGuideTarget, setGradeGuideTarget] = useState<"buy" | "sell" | "buy-offer" | null>(
    null,
  );
  // 등급별 가격을 그냥 보여주면 그게 구매가인지 판매가인지 헷갈린다는 피드백 반영 — 먼저
  // "구매/판매" 중 하나를 고르게 하고, 그 다음에야 등급 그리드(와 그 안의 가격 의미)가 나타난다.
  const [tradeIntent, setTradeIntent] = useState<"buy" | "sell" | null>(null);

  const [priceSummary, setPriceSummary] = useState<PriceSummaryResponse | null>(null);
  // 비로그인이거나 체결 이력이 부족해 계산할 수 없으면 null — 뱃지 자체를 숨긴다(에러 UI 없음).
  const [priceStats, setPriceStats] = useState<PriceStatsResponse | null>(null);
  const [activeListings, setActiveListings] = useState<ListingSummaryResponse[]>([]);
  // 판매 모드 등급 그리드의 "최고 구매입찰가" 참고용 — 구매 모드의 activeListings와 대응.
  const [buyOffers, setBuyOffers] = useState<BuyOfferOrderbookEntryResponse[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<GradeKey | null>(null);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("30d");
  const [chartData, setChartData] = useState<TradeSummaryResponse[]>([]);
  const [chartLoadState, setChartLoadState] = useState<RelatedLoadState>("loading");
  const [chartError, setChartError] = useState<ApiError | null>(null);
  // GET /api/listings, GET /api/prices/{cardId}/buy-offers 둘 다 인증이 필요해 401이 날 수 있다 —
  // "상품/입찰 없음"과 "조회 권한 없음"을 구분해서 보여주기 위한 별도 상태.
  const [listingsError, setListingsError] = useState<ApiError | null>(null);
  const [buyOffersError, setBuyOffersError] = useState<ApiError | null>(null);
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
      triggerCopied();
    } catch {
      // 클립보드 접근이 차단된 환경(권한 거부 등)에서는 조용히 무시.
    }
  };

  // 등급 안내 모달의 확인 버튼.
  // - "buy": 선택된 매물을 들고 즉시구매 주문서(/trades/checkout/order)로 이동한다 - 실제 ready
  //   호출/결제는 그 페이지(받는사람 정보 입력 이후)에서 이어간다.
  // - "sell"/"buy-offer": 지금 선택된 카드/판본/등급을 쿼리로 넘겨서 판매(/listings/new) 또는
  //   구매입찰(/buy-offers/new) 등록 페이지로 이동한다. RAW(미등급)는 "선택 안 함"과 같은 뜻이라
  //   grade 파라미터 자체를 안 붙인다(두 등록 페이지 모두 grade 생략을 "선택 안 함"으로 처리).
  const confirmGradeGuide = () => {
    if (!gradeGuideTarget || cardId == null) return;

    if (gradeGuideTarget === "buy") {
      if (userStatus === "loading") return; // 세션 복원 중 — 확정될 때까지 아무 것도 하지 않는다.
      if (userStatus !== "authenticated") {
        setGradeGuideTarget(null);
        router.push(loginUrlFor(pathname, searchParams));
        return;
      }
      // 안내 모달을 여는 시점의 gradeSummary를 그대로 다시 계산 - activeListings는 그 사이 안 바뀜.
      const gradeSummary = computeGradeSummary(activeListings);
      const offer = selectedGrade ? gradeSummary[selectedGrade] : undefined;
      setGradeGuideTarget(null);
      if (!offer) return;

      const orderParams = new URLSearchParams({
        listingId: String(offer.listingId),
        cardId: String(cardId),
        price: String(offer.price),
      });
      if (card) {
        const cardImage = resolveMainImageSrc(card, selectedVariantId);
        if (cardImage) orderParams.set("cardImage", cardImage);
      }
      if (selectedGrade) orderParams.set("grade", GRADE_LABELS[selectedGrade]);
      router.push(`/trades/checkout/order?${orderParams.toString()}`);
      return;
    }

    const basePath = gradeGuideTarget === "sell" ? "/listings/new" : "/buy-offers/new";
    const params = new URLSearchParams({ cardId: String(cardId) });
    if (selectedVariantId != null) params.set("variantId", String(selectedVariantId));
    if (selectedGrade && selectedGrade !== "RAW") params.set("grade", selectedGrade);
    setGradeGuideTarget(null);
    router.push(`${basePath}?${params.toString()}`);
  };

  // /search에서 스크롤을 많이 내린 상태로 카드를 클릭하면, 상세 페이지가 처음
  // 커밋되는 순간(로딩 스피너, 짧은 문서 높이)에 브라우저가 scrollY를 그 문서의
  // 바닥으로 강제 클램프한다. 데이터 페칭 effect보다 먼저 실행되도록 맨 위에 둔다.
  useEffect(() => {
    window.scrollTo(0, 0);
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
    if (loadState !== "ready" || cardId == null || !card) return;
    let cancelled = false;
    // 판본이 2개 이상인 카드는 대표 판본 가격을 아래 판본별 시세 비교 effect에서
    // fetchPriceSummary(cardId, primaryVariantId)로 이미 조회하므로(BE는 variantId 생략 시
    // 대표 판본 기준으로 응답), 여기서 fetchPriceSummary(cardId)를 중복 요청하지 않는다.
    const hasSingleVariant = card.variants.length <= 1;

    Promise.allSettled([
      hasSingleVariant ? fetchPriceSummary(cardId) : Promise.resolve(null),
      fetchActiveListings(cardId),
      fetchBuyOfferOrderbook(cardId),
    ]).then(([summaryResult, listingsResult, buyOffersResult]) => {
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
      if (buyOffersResult.status === "fulfilled") {
        setBuyOffers(buyOffersResult.value);
        setBuyOffersError(null);
      } else {
        setBuyOffers([]);
        setBuyOffersError(
          buyOffersResult.reason instanceof ApiError
            ? buyOffersResult.reason
            : new ApiError(0, "UNKNOWN", "구매입찰 정보를 불러오지 못했습니다."),
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
          // 지원하지 않는 통화면 잘못된 환율(1배)로 추정치를 만드는 대신 해당 포인트를 건너뛴다.
          const points = result.value.flatMap((point) => {
            const krw = toKrw(point.price, point.currency);
            return krw == null ? [] : [{ tradedAt: point.date, price: krw, grade }];
          });
          if (points.length > 0) sourceByGrade.set(grade, points);
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
            <span role="alert" className="text-[13.5px] font-bold text-[#D14343]">
              {errorMessage}
            </span>
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
          cardId != null &&
          (() => {
            const displayName = card.nameKo ?? card.name;
            const mainImageSrc = resolveMainImageSrc(card, selectedVariantId);
            const gradeSummary = computeGradeSummary(activeListings);
            const buyOfferSummary = computeBuyOfferSummary(buyOffers);
            const selectedOffer = selectedGrade ? gradeSummary[selectedGrade] : undefined;
            // 등급을 선택했으면 그 등급의 실제 최저 매물가를 우선 보여준다 — 선택 전(또는 방금
            // 선택한 등급에 매물이 없어진 방어적 상황)에는 기존처럼 전체 등급 통틀어 최저가로 폴백.
            const displayBuyPrice = selectedOffer?.price ?? priceSummary?.buyPrice ?? null;

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
                        {/* EN(기본값)이 절대다수라 EN은 생략하고, 눈에 띄어야 하는 예외
                            (JA 등 비영어판)만 표시한다 — 검색 타일과 동일한 정책(SearchResultsView.tsx). */}
                        {card.languageCode !== "EN" && (
                          <span className="mt-1.5 inline-flex w-fit items-center rounded-full border border-[#DDDDE3] bg-white px-2.5 py-1 text-[11.5px] font-bold text-[#4B4B52]">
                            {card.languageCode}
                          </span>
                        )}
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

                    <VariantPriceComparison cardId={cardId} variants={card.variants} />

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

                  <div className="flex flex-col gap-4 lg:sticky lg:top-8 lg:self-start">
                    <div className="flex flex-col gap-4 rounded-2xl border border-[#EDEDF0] bg-white p-5">
                      <div>
                        <div className="text-[12px] font-semibold text-[#8A8A92]">즉시구매가</div>
                        <div className="mt-1 text-[24px] font-extrabold text-primary">
                          {priceLoadState === "loading" ? (
                            <span className="text-[14px] font-semibold text-[#9A9AA2]">
                              불러오는 중...
                            </span>
                          ) : displayBuyPrice != null ? (
                            `${displayBuyPrice.toLocaleString("ko-KR")}원`
                          ) : (
                            <span className="text-[14px] font-semibold text-[#9A9AA2]">
                              상품 없음
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="border-t border-[#F5F5F7] pt-4">
                        {tradeIntent === null ? (
                          <>
                            <div className="mb-2.5 text-[12.5px] font-bold text-ink">
                              거래 방식 선택
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setTradeIntent("buy");
                                  setSelectedGrade(null);
                                }}
                                className="rounded-xl border border-[#DDDDE3] bg-white py-4 text-[14px] font-bold text-ink transition hover:border-primary hover:bg-lavender"
                              >
                                구매하기
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setTradeIntent("sell");
                                  setSelectedGrade(null);
                                }}
                                className="rounded-xl border border-[#DDDDE3] bg-white py-4 text-[14px] font-bold text-ink transition hover:border-primary hover:bg-lavender"
                              >
                                판매하기
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="mb-2.5 flex items-center justify-between">
                              <div className="text-[12.5px] font-bold text-ink">
                                {tradeIntent === "buy" ? "구매할 등급 선택" : "판매할 등급 선택"}
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setTradeIntent(null);
                                  setSelectedGrade(null);
                                }}
                                className="text-[11.5px] font-semibold text-[#8A8A92] hover:text-primary"
                              >
                                ← 다시 선택
                              </button>
                            </div>

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
                              tradeIntent === "buy" &&
                              (listingsError ? (
                                listingsError.status === 401 || listingsError.status === 403 ? (
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
                                )
                              ) : (
                                <div className="grid grid-cols-2 gap-2">
                                  {GRADE_ORDER.map((grade) => {
                                    const offer = gradeSummary[grade];
                                    const hasStock = offer != null;
                                    const isSelected = selectedGrade === grade;
                                    // 재고 없는 등급도 선택은 가능하게 한다 — 선택하면 아래 CTA가
                                    // "구매하기" 대신 "구매입찰 등록"으로 바뀐다.
                                    return (
                                      <button
                                        key={grade}
                                        type="button"
                                        onClick={() => setSelectedGrade(grade)}
                                        className={`flex flex-col items-center gap-0.5 rounded-xl border px-2 py-2.5 transition ${
                                          isSelected
                                            ? "border-primary bg-lavender"
                                            : hasStock
                                              ? "border-[#DDDDE3] bg-white hover:border-primary"
                                              : "border-[#EDEDF0] bg-neutral hover:border-primary"
                                        }`}
                                      >
                                        <span className="text-[12px] font-extrabold text-ink">
                                          {GRADE_LABELS[grade]}
                                        </span>
                                        <span className="text-[11px] font-semibold text-[#8A8A92]">
                                          {hasStock
                                            ? `${offer.price.toLocaleString("ko-KR")}원`
                                            : "상품 없음 · 입찰 가능"}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              ))}

                            {priceLoadState === "ready" &&
                              tradeIntent === "sell" &&
                              (buyOffersError ? (
                                buyOffersError.status === 401 || buyOffersError.status === 403 ? (
                                  <div className="flex flex-col items-center gap-2 rounded-xl bg-neutral py-8 text-center text-[13px] text-[#9A9AA2]">
                                    <span>등급별 구매입찰은 로그인 후 확인할 수 있습니다.</span>
                                    <Link
                                      href={loginUrlFor(pathname, searchParams)}
                                      className="text-[12.5px] font-bold text-primary hover:text-primary-dark"
                                    >
                                      로그인하기
                                    </Link>
                                  </div>
                                ) : (
                                  <div className="rounded-xl bg-neutral py-8 text-center text-[13px] text-[#9A9AA2]">
                                    구매입찰 정보를 불러오지 못했습니다.
                                  </div>
                                )
                              ) : (
                                <div className="grid grid-cols-2 gap-2">
                                  {GRADE_ORDER.map((grade) => {
                                    const bid = buyOfferSummary[grade];
                                    const isSelected = selectedGrade === grade;
                                    // 판매는 재고 개념이 없어 모든 등급을 항상 선택할 수 있다 —
                                    // 여기 뜨는 가격은 "지금 이 등급을 팔면 대략 받을 수 있는
                                    // 참고 시세"(최고 구매입찰가)일 뿐, 없어도 판매 자체는 가능하다.
                                    return (
                                      <button
                                        key={grade}
                                        type="button"
                                        onClick={() => setSelectedGrade(grade)}
                                        className={`flex flex-col items-center gap-0.5 rounded-xl border px-2 py-2.5 transition ${
                                          isSelected
                                            ? "border-primary bg-lavender"
                                            : "border-[#DDDDE3] bg-white hover:border-primary"
                                        }`}
                                      >
                                        <span className="text-[12px] font-extrabold text-ink">
                                          {GRADE_LABELS[grade]}
                                        </span>
                                        <span className="text-[11px] font-semibold text-[#8A8A92]">
                                          {bid != null
                                            ? `구매입찰 ${bid.toLocaleString("ko-KR")}원`
                                            : "구매입찰 없음"}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              ))}
                          </>
                        )}
                      </div>

                      {tradeIntent === "buy" &&
                        (() => {
                          // 선택된 등급에 매물이 없으면 "구매하기" 대신 그 등급으로 구매입찰을 미리
                          // 걸 수 있게 한다 — 재고가 생기길 기다리지 않고 원하는 가격에 예약해두는 흐름.
                          const showBuyOfferCta = selectedGrade != null && !selectedOffer;
                          return (
                            <button
                              type="button"
                              disabled={
                                userStatus === "loading" || (!showBuyOfferCta && !selectedOffer)
                              }
                              onClick={() => {
                                if (showBuyOfferCta) {
                                  setGradeGuideTarget("buy-offer");
                                  return;
                                }
                                if (!selectedOffer) return;
                                setGradeGuideTarget("buy");
                              }}
                              className="mt-1 w-full rounded-[11px] border-2 border-primary-dark bg-primary py-3.5 text-[15px] font-bold text-white shadow-tactile transition active:translate-y-0.5 active:shadow-tactile-active disabled:cursor-not-allowed disabled:border-[#DDDDE3] disabled:bg-neutral disabled:text-[#9A9AA2] disabled:shadow-none"
                            >
                              {userStatus === "loading"
                                ? "인증 확인 중..."
                                : showBuyOfferCta
                                  ? "구매입찰 등록"
                                  : selectedOffer
                                    ? "구매하기"
                                    : "등급을 선택하세요"}
                            </button>
                          );
                        })()}

                      {tradeIntent === "sell" && (
                        <button
                          type="button"
                          disabled={userStatus === "loading" || selectedGrade == null}
                          onClick={() => setGradeGuideTarget("sell")}
                          className="mt-1 w-full rounded-[11px] border-2 border-primary-dark bg-primary py-3.5 text-[15px] font-bold text-white shadow-tactile transition active:translate-y-0.5 active:shadow-tactile-active disabled:cursor-not-allowed disabled:border-[#DDDDE3] disabled:bg-neutral disabled:text-[#9A9AA2] disabled:shadow-none"
                        >
                          {userStatus === "loading"
                            ? "인증 확인 중..."
                            : selectedGrade != null
                              ? "판매하기"
                              : "등급을 선택하세요"}
                        </button>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setWatchlistModalOpen(true)}
                          aria-label="관심 등록"
                          className="w-full rounded-[11px] border-[1.5px] border-[#DDDDE3] bg-white py-2.5 text-[13.5px] font-bold text-[#4B4B52] transition hover:border-primary hover:text-primary"
                        >
                          관심 등록
                        </button>
                        {watchlistAdded && (
                          <span className="whitespace-nowrap text-[12.5px] font-bold text-primary">
                            등록됨
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[#EDEDF0] bg-white p-5">
                      <OrderActivitySection cardId={cardId} variantId={selectedVariantId} />
                    </div>
                  </div>
                </div>

                <RelatedCardsSection cardId={cardId} />

                <ImageLightbox
                  isOpen={lightboxOpen}
                  onClose={() => setLightboxOpen(false)}
                  imageSrc={mainImageSrc}
                  alt={displayName}
                />

                <AddWatchlistModal
                  isOpen={watchlistModalOpen}
                  onClose={() => setWatchlistModalOpen(false)}
                  cardId={cardId}
                  variantId={selectedVariantId}
                  onSuccess={triggerWatchlistAdded}
                />

                <GradeGuideModal
                  isOpen={gradeGuideTarget != null}
                  onClose={() => setGradeGuideTarget(null)}
                  onConfirm={confirmGradeGuide}
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
