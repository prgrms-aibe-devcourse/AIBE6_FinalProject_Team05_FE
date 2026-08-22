"use client";

import Link from "next/link";
import { usePathname, useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import CardImage from "@/components/CardImage";
import PriceChart from "@/components/PriceChart";
import Toast from "@/components/Toast";
import IconTooltip from "@/components/IconTooltip";
import ImageLightbox from "@/components/ImageLightbox";
import RelatedCardsSection from "./RelatedCardsSection";
import VariantPriceComparison from "./VariantPriceComparison";
import OrderActivitySection from "./OrderActivitySection";
import GradeGuideModal from "./GradeGuideModal";
import TradeMethodModal from "./TradeMethodModal";
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
import { fetchWatchlist, fetchWatchlistCounts } from "@/lib/watchlistApi";
import { WatchlistResponse } from "@/types/watchlist";
import { readyTradePurchase } from "@/lib/tradeApi";
import { useUserStore } from "@/store/useUserStore";
import { loginUrlFor } from "@/lib/authRedirect";
import { toKrw } from "@/lib/currency";
import { useTimedFlag } from "@/hooks/useTimedFlag";
import { useHeartPunch } from "@/hooks/useHeartPunch";
import {
  QuickWatchlistToggleStatus,
  useQuickWatchlistToggle,
} from "@/hooks/useQuickWatchlistToggle";
import { useToast } from "@/hooks/useToast";
import {
  WATCHLIST_ADDED_TOAST,
  WATCHLIST_ADDED_TOAST_MS,
  WATCHLIST_REMOVED_TOAST,
} from "@/lib/watchlistToast";

type LoadState = "loading" | "error" | "notfound" | "ready";
type RelatedLoadState = "loading" | "ready";

// 등급별 최저가 매물 — 구매하기 버튼이 어떤 매물(listingId)을 살지 알아야 해서 가격뿐 아니라 id도 들고 있는다.
// count: 해당 등급에 몇 명의 판매자(매물)가 있는지 — 최저가 1건으로 압축되면서 사라지는 정보라 별도로 센다.
interface GradeOffer {
  listingId: number;
  price: number;
  count: number;
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
      summary[key] = { listingId: l.id, price: l.price, count: (current?.count ?? 0) + 1 };
    } else {
      summary[key] = { ...current, count: current.count + 1 };
    }
  }
  return summary;
}

// 등급별 최고가 구매입찰 — 판매 모드일 때 등급 그리드에 "이 등급을 지금 팔면 대략 얼마 받을 수
// 있는지" 참고용으로 보여주고, 즉시판매(#238) 선택 시 정확히 이 구매입찰에 매칭시켜야 하므로
// buyOfferId도 함께 들고 있는다.
interface BuyOfferSummaryEntry {
  buyOfferId: number;
  price: number;
}

function computeBuyOfferSummary(
  buyOffers: BuyOfferOrderbookEntryResponse[],
): Partial<Record<GradeKey, BuyOfferSummaryEntry>> {
  const summary: Partial<Record<GradeKey, BuyOfferSummaryEntry>> = {};
  for (const o of buyOffers) {
    const key: GradeKey = o.grade ?? "RAW";
    const current = summary[key];
    if (current == null || o.price > current.price) {
      summary[key] = { buyOfferId: o.buyOfferId, price: o.price };
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
  const userId = useUserStore((s) => s.userId);
  const userIdRestoring = useUserStore((s) => s.userIdRestoring);

  const [card, setCard] = useState<CardDetailResponse | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);
  const [copied, triggerCopied] = useTimedFlag(2000);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  // 등급 선택에서 "판매"/"구매입찰 등록"을 누르면 등급 안내 모달을 먼저 보여주고, 확인 시 이
  // target에 맞는 등록 페이지로 이동한다. 모달 자체는 어디로 갈지 모르므로 여기서 target을 들고 있는다.
  const [gradeGuideTarget, setGradeGuideTarget] = useState<
    "buy" | "sell" | "buy-offer" | "sell-instant" | null
  >(null);
  // 등급에 상대편 주문(매물/구매입찰)이 이미 있어도, 그 가격에 즉시 거래할지 원하는 가격에 직접
  // 입찰/등록할지 먼저 물어본다(#238) — 등급 안내 모달보다 앞선 단계라 별도 state로 관리한다.
  const [tradeMethodChoice, setTradeMethodChoice] = useState<{
    mode: "buy" | "sell";
    matchedPrice: number;
  } | null>(null);
  // 등급별 가격을 그냥 보여주면 그게 구매가인지 판매가인지 헷갈린다는 피드백 반영 — 먼저
  // "구매/판매" 중 하나를 고르게 하고, 그 다음에야 등급 그리드(와 그 안의 가격 의미)가 나타난다.
  const [tradeIntent, setTradeIntent] = useState<"buy" | "sell" | null>(null);
  // 이 카드가 이미 내 워치리스트에 있는지(하트 채움 여부 판정용). 목표가는 이 화면에서 더 이상
  // 수정하지 않고 /watchlist에서만 다룬다(#235) — 등록 직후 토스트가 "관심 목록 →"으로 그 경로를
  // 안내하므로, 카드 상세에는 관심 등록/해제 하나만 남긴다.
  // 삭제에 필요한 id만 들고 있는다 — 목표가는 담기더라도 읽는 곳이 없어 그만큼 낡은 값이
  // 남을 뿐이라, 이 화면이 실제로 쓰는 필드까지만 좁힌다.
  const [myWatchlist, setMyWatchlist] = useState<Pick<WatchlistResponse, "id"> | null>(null);
  const [watchlistToggleError, setWatchlistToggleError] = useState<string | null>(null);
  const { toast, showToast, pauseToast, resumeToast } = useToast();
  const { triggerPunch, punchKey, punchClass } = useHeartPunch();
  const { toggle: toggleWatchlist, pendingCardId: watchlistPendingCardId } =
    useQuickWatchlistToggle();

  const [priceSummary, setPriceSummary] = useState<PriceSummaryResponse | null>(null);
  // 비로그인이거나 체결 이력이 부족해 계산할 수 없으면 null — 뱃지 자체를 숨긴다(에러 UI 없음).
  const [priceStats, setPriceStats] = useState<PriceStatsResponse | null>(null);
  // 관심수 조회 실패 시에도 null로 남겨 "관심 등록" 버튼 텍스트에서 숫자만 생략한다.
  const [watchlistCount, setWatchlistCount] = useState<number | null>(null);
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
  // - "sell-instant": TradeMethodModal에서 "즉시판매"를 선택했을 때 - matchedBuyOfferId로 특정된
  //   구매입찰에 매칭시키는 주문서(/buy-offers/fulfill/order)로 이동한다(#238).
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

    if (gradeGuideTarget === "sell-instant") {
      if (userStatus === "loading") return;
      if (userStatus !== "authenticated") {
        setGradeGuideTarget(null);
        router.push(loginUrlFor(pathname, searchParams));
        return;
      }
      // 안내 모달을 여는 시점의 buyOfferSummary를 그대로 다시 계산 - buyOffers는 그 사이 안 바뀐다.
      const buyOfferSummary = computeBuyOfferSummary(buyOffers);
      const bid = selectedGrade ? buyOfferSummary[selectedGrade] : undefined;
      setGradeGuideTarget(null);
      if (!bid) return;

      const orderParams = new URLSearchParams({
        buyOfferId: String(bid.buyOfferId),
        cardId: String(cardId),
        price: String(bid.price),
      });
      if (card) {
        const cardImage = resolveMainImageSrc(card, selectedVariantId);
        if (cardImage) orderParams.set("cardImage", cardImage);
      }
      if (selectedGrade) orderParams.set("grade", GRADE_LABELS[selectedGrade]);
      router.push(`/buy-offers/fulfill/order?${orderParams.toString()}`);
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

  // "관심 등록" 버튼 옆 관심수. 조회 실패는 조용히 무시 — 버튼 자체는 그대로 정상 동작해야 한다.
  useEffect(() => {
    if (loadState !== "ready" || cardId == null) return;
    let cancelled = false;

    fetchWatchlistCounts([cardId])
      .then((counts) => {
        if (cancelled) return;
        setWatchlistCount(counts.get(cardId) ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setWatchlistCount(null);
      });

    return () => {
      cancelled = true;
    };
  }, [cardId, loadState]);

  // 이 카드가 이미 내 워치리스트에 있는지 + 목표가 수정 모달에 쓸 현재 목표가.
  // BE는 사용자당 카드 하나에 항목 하나만 허용(variantId 무관, existsByUserIdAndCardId) — cardId로만 매칭한다.
  useEffect(() => {
    if (loadState !== "ready" || cardId == null || userStatus !== "authenticated") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 비로그인/카드 전환 시 낡은 상태를 비운다.
      setMyWatchlist(null);
      return;
    }
    let cancelled = false;

    fetchWatchlist()
      .then((list) => {
        if (cancelled) return;
        const found = list.find((w) => w.cardId === cardId);
        setMyWatchlist(found ? { id: found.id } : null);
      })
      .catch(() => {
        if (!cancelled) setMyWatchlist(null);
      });

    return () => {
      cancelled = true;
    };
  }, [cardId, loadState, userStatus]);

  // 토글 결과 status를 그대로 돌려준다 — 하트 펀치를 "서버가 등록을 확정한 뒤"에만
  // 재생하기 위해 호출부(버튼)가 이 값을 보고 분기한다.
  // cardId가 아직 없어 토글 자체를 건너뛴 경우는 null(=재생 안 함).
  const handleWatchlistToggle = async (): Promise<QuickWatchlistToggleStatus | null> => {
    if (cardId == null) return null;
    setWatchlistToggleError(null);
    const result = await toggleWatchlist(cardId, myWatchlist?.id ?? null, selectedVariantId);
    if (result.status === "added") {
      setMyWatchlist({ id: result.watchlistId });
      // 관심수 재조회 없이 즉시 +1 — 다른 탭에서 이미 등록된 카드를 모르고 등록 시도한
      // DUPLICATE_WATCHLIST 경합처럼 드문 경우엔 실제보다 1 높게 보일 수 있지만,
      // 다음 새로고침/재조회 시 정확한 값으로 맞춰지는 일시적 드리프트라 지금은 감내한다.
      setWatchlistCount((c) => (c ?? 0) + 1);
      showToast(WATCHLIST_ADDED_TOAST, WATCHLIST_ADDED_TOAST_MS);
    } else if (result.status === "removed") {
      setMyWatchlist(null);
      setWatchlistCount((c) => (c != null ? Math.max(0, c - 1) : c));
      showToast(WATCHLIST_REMOVED_TOAST);
    } else if (result.status === "error") {
      setWatchlistToggleError(result.message);
      setTimeout(() => setWatchlistToggleError(null), 3000);
    }
    return result.status;
  };

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
            // 선택된 등급에 매물이 없으면 "구매하기" 대신 그 등급으로 구매입찰을 미리 걸 수
            // 있게 한다 — 재고가 생기길 기다리지 않고 원하는 가격에 예약해두는 흐름.
            const showBuyOfferCta =
              tradeIntent === "buy" && selectedGrade != null && !selectedOffer;
            // 등급을 선택했으면 그 등급의 실제 최저 매물가를 우선 보여준다 — 선택 전(또는 방금
            // 선택한 등급에 매물이 없어진 방어적 상황)에는 기존처럼 전체 등급 통틀어 최저가로 폴백.
            const displayBuyPrice = selectedOffer?.price ?? priceSummary?.buyPrice ?? null;
            // userId 복원이 끝나기 전에는 판정을 내리지 않는다(trade-status 페이지와 동일한 이유) —
            // 안 그러면 실제 판매자에게도 일시적으로 "내 매물 없음"으로 보일 수 있다.
            const myListings =
              userIdRestoring || userId == null
                ? []
                : activeListings.filter((l) => l.sellerId === userId);

            return (
              <>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
                  <div className="flex flex-col gap-6">
                    <div className="relative flex gap-6 rounded-2xl border border-[#EDEDF0] bg-white p-6">
                      <div className="absolute right-6 top-6 flex flex-col items-end gap-1.5">
                        {priceStats &&
                          priceStats.changeRate !== 0 &&
                          (() => {
                            const isRise = priceStats.changeRate > 0;
                            const sign = isRise ? "+" : "-";
                            return (
                              <div className="flex items-center gap-1.5">
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
                        {/* 0/낮은 값도 그대로 노출 — 관심수와 달리 조회수는 숨길 이유가 없는
                            신뢰 신호(활발히 조회되는 카드라는 근거)로 쓰기로 정했다. null/undefined(값
                            없음)는 0과 다르므로 이때만 숨긴다 — 프로덕션 크래시 핫픽스. */}
                        {card.viewCount != null && (
                          <span className="text-[11.5px] font-semibold text-[#9A9AA2]">
                            {card.viewCount.toLocaleString("ko-KR")}번 조회됐어요
                          </span>
                        )}
                      </div>
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
                        {/* types가 null인 카드가 실제로 있다(#235) — 빈 배열과 같게 취급해 숨긴다. */}
                        {!!card.types?.length && (
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

                      {watchlistToggleError && (
                        <span role="alert" className="text-[12px] font-semibold text-primary">
                          {watchlistToggleError}
                        </span>
                      )}

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
                                            ? `${bid.price.toLocaleString("ko-KR")}원`
                                            : "상품 없음"}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              ))}
                          </>
                        )}
                      </div>

                      {/* 주된 액션(구매하기/판매하기, tradeIntent에 따라 바뀜)과 관심 등록(보조
                          액션)을 한 행에 둔다(#235) — 둘 다 "이 카드 자체"에 대한 액션이라 나란히
                          두는 게 자연스럽고, 가격은 옆에 아무것도 붙지 않아야 강조가 유지된다.
                          flex-1/flex-shrink-0으로 주 버튼이 남는 폭을 전부 가져간다.
                          items-stretch: 한 행에 나란히 놓인 컨트롤은 높이를 공유해야 한 세트로 읽힌다 —
                          하트만 낮추면 위아래 여백이 생겨 정렬선이 끊기고 덧붙인 것처럼 보인다(#235).
                          위계는 높이가 아니라 폭(약 4:1)과 색(흰 배경·회색 1px vs 빨강·2px·shadow)으로 준다. */}
                      <div className="mt-1 flex items-stretch gap-2">
                        <button
                          type="button"
                          disabled={
                            userStatus === "loading" ||
                            (tradeIntent === "sell"
                              ? selectedGrade == null
                              : !showBuyOfferCta && !selectedOffer)
                          }
                          onClick={() => {
                            if (tradeIntent === "sell") {
                              if (selectedGrade == null) return;
                              const matchedBid = buyOfferSummary[selectedGrade];
                              if (matchedBid) {
                                // 이미 구매입찰이 있어도 즉시판매/매물 등록 중 고를 수 있게 한 번 더
                                // 물어본다(#238).
                                setTradeMethodChoice({ mode: "sell", matchedPrice: matchedBid.price });
                                return;
                              }
                              setGradeGuideTarget("sell");
                              return;
                            }
                            if (showBuyOfferCta) {
                              setGradeGuideTarget("buy-offer");
                              return;
                            }
                            if (!selectedOffer) return;
                            // 이미 매물이 있어도 즉시구매/구매입찰 중 고를 수 있게 한 번 더 물어본다(#238).
                            setTradeMethodChoice({ mode: "buy", matchedPrice: selectedOffer.price });
                          }}
                          className="flex-1 rounded-[11px] border-2 border-primary-dark bg-primary py-3.5 text-[15px] font-bold text-white shadow-tactile transition active:translate-y-0.5 active:shadow-tactile-active disabled:cursor-not-allowed disabled:border-[#DDDDE3] disabled:bg-neutral disabled:text-[#9A9AA2] disabled:shadow-none"
                        >
                          {userStatus === "loading"
                            ? "인증 확인 중..."
                            : tradeIntent === "sell"
                              ? selectedGrade != null
                                ? "판매하기"
                                : "등급을 선택하세요"
                              : showBuyOfferCta
                                ? "구매입찰 등록"
                                : selectedOffer
                                  ? "구매하기"
                                : "등급을 선택하세요"}
                        </button>
                        <IconTooltip
                          label={myWatchlist ? "관심 해제" : "관심 등록"}
                          placement="top"
                          className="flex-shrink-0"
                        >
                          <button
                            type="button"
                            onClick={async () => {
                              // 서버가 등록을 확정한 뒤에만 펀치(useHeartPunch 주석 참고) —
                              // 클릭 시점 상태로 미리 재생하면 등록이 실패해도 하트가 튀어올라
                              // 성공한 것처럼 보인다.
                              const status = await handleWatchlistToggle();
                              if (status === "added" && cardId != null) triggerPunch(cardId);
                            }}
                            disabled={watchlistPendingCardId === cardId}
                            aria-label={
                              myWatchlist
                                ? watchlistCount
                                  ? `관심 해제 (${watchlistCount.toLocaleString("ko-KR")})`
                                  : "관심 해제"
                                : watchlistCount
                                  ? `관심 등록 (${watchlistCount.toLocaleString("ko-KR")})`
                                  : "관심 등록"
                            }
                            // 높이는 부모 items-stretch로 구매 버튼과 정확히 같아진다 — 44px을 훌쩍
                            // 넘으므로 예전의 음수 마진 트릭(-m/p) 없이도 터치 타겟이 충족된다.
                            // 아이콘 위 / 숫자 아래로 쌓아(flex-col) 구매 버튼과 높이를 맞추며 생긴 세로
                            // 여유를 쓰고, 그만큼 가로를 줄인다 — 숫자가 옆으로 붙지 않으니 폭은 min-w-11
                            // (44px, 터치 타겟 최소값)에서 거의 고정된다. 세로는 stretch로 충분하지만
                            // 가로는 이 바닥값이 없으면 44px을 못 채운다.
                            // 모서리·테두리는 구매 박스 언어 그대로 — radius는 옆 구매 버튼과 같은 11px,
                            // 테두리는 등급 선택 버튼과 같은 1px/#DDDDE3.
                            className="flex flex-shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <span
                              className={`flex min-w-11 items-center justify-center rounded-[11px] border px-2 transition ${
                                myWatchlist
                                  ? "border-primary bg-lavender"
                                  : "border-[#DDDDE3] bg-white hover:border-primary hover:bg-[#FFF5F5]"
                              }`}
                            >
                              {/* 아이콘과 숫자를 한 덩어리로 감싸 함께 튀게 한다 — 알약 자체에
                                  애니메이션을 걸면 테두리/배경까지 같이 흔들려 과해 보인다. */}
                              <span
                                key={punchKey(cardId ?? -1)}
                                className={`flex flex-col items-center gap-0.5 ${punchClass(cardId ?? -1)}`}
                              >
                                <svg
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  stroke="#EE1515"
                                  strokeWidth="2"
                                  fill={myWatchlist ? "#EE1515" : "none"}
                                  aria-hidden="true"
                                >
                                  <path
                                    d="M19 14c1.5-1.5 3-3.3 3-5.5A3.5 3.5 0 0018.5 5c-1.6 0-3 1-3.5 2.5C14.5 6 13.1 5 11.5 5A3.5 3.5 0 008 8.5c0 2.2 1.5 4 3 5.5l4 4z"
                                    transform="translate(-3 0)"
                                  />
                                </svg>
                                {/* 0/조회 실패(null)는 표시할 의미 있는 숫자가 없다고 보고 숨긴다 —
                                    신규 카드에 "0"이 찍혀 위축감을 주는 것도 피한다.
                                    개수는 버튼의 aria-label에 이미 들어 있어 여기선 aria-hidden. */}
                                {!!watchlistCount && (
                                  <span
                                    aria-hidden="true"
                                    className={`text-[11.5px] font-semibold ${
                                      myWatchlist ? "text-primary" : "text-[#9A9AA2]"
                                    }`}
                                  >
                                    {watchlistCount.toLocaleString("ko-KR")}
                                  </span>
                                )}
                              </span>
                            </span>
                          </button>
                        </IconTooltip>
                      </div>

                    </div>

                    <div className="rounded-2xl border border-[#EDEDF0] bg-white p-5">
                      <OrderActivitySection cardId={cardId} variantId={selectedVariantId} />
                    </div>
                  </div>
                </div>

                {myListings.length > 0 && (
                  <div className="rounded-2xl border border-[#EDEDF0] bg-white p-5">
                    <div className="mb-2.5 text-[13px] font-bold text-ink">
                      판매 중인 내 매물 ({myListings.length}개)
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {myListings.map((l) => (
                        <span
                          key={l.id}
                          className="rounded-full border border-[#DDDDE3] bg-neutral px-3 py-1.5 text-[12.5px] font-semibold text-[#4B4B52]"
                        >
                          {l.grade ?? "미등급"} · {l.price.toLocaleString("ko-KR")}원
                        </span>
                      ))}
                    </div>
                    <Link
                      href="/listings/me"
                      className="mt-3 inline-block text-[12.5px] font-bold text-primary hover:text-primary-dark"
                    >
                      내 매물 관리 &gt;
                    </Link>
                  </div>
                )}

                <RelatedCardsSection cardId={cardId} />

                <ImageLightbox
                  isOpen={lightboxOpen}
                  onClose={() => setLightboxOpen(false)}
                  imageSrc={mainImageSrc}
                  alt={displayName}
                />

                <GradeGuideModal
                  isOpen={gradeGuideTarget != null}
                  onClose={() => setGradeGuideTarget(null)}
                  onConfirm={confirmGradeGuide}
                />

                {tradeMethodChoice && (
                  <TradeMethodModal
                    isOpen
                    mode={tradeMethodChoice.mode}
                    matchedPrice={tradeMethodChoice.matchedPrice}
                    onClose={() => setTradeMethodChoice(null)}
                    onChooseInstant={() => {
                      setTradeMethodChoice(null);
                      setGradeGuideTarget(tradeMethodChoice.mode === "buy" ? "buy" : "sell-instant");
                    }}
                    onChooseAlternative={() => {
                      setTradeMethodChoice(null);
                      setGradeGuideTarget(tradeMethodChoice.mode === "buy" ? "buy-offer" : "sell");
                    }}
                  />
                )}
              </>
            );
          })()}
      </div>

      <Toast toast={toast} onPause={pauseToast} onResume={resumeToast} />
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
