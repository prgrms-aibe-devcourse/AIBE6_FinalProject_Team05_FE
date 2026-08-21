"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchBar } from "@/components/CardSearchBar";
import { CardFacetsResponse, CardSearchItem, toCardSearchItem } from "@/types/card";
import { CardPriceSummaryResponse } from "@/types/price";
import { CardSort, fetchCardFacets, fetchCardsPage, fetchPriceSummaries } from "@/lib/cardApi";
import { ApiError } from "@/lib/apiClient";
import { fetchWatchlist } from "@/lib/watchlistApi";
import { useEscapeAndScrollLock } from "@/hooks/useEscapeAndScrollLock";
import { useQuickWatchlistToggle } from "@/hooks/useQuickWatchlistToggle";
import { useUserStore } from "@/store/useUserStore";
import { isPriceSort, MARKET_PAGE_SIZE, PRICE_MAX, UiSort } from "./constants";
import SearchResultsView from "./SearchResultsView";

const EMPTY_FACETS: CardFacetsResponse = { types: [], rarities: [], expansions: [] };

// URL의 minPrice/maxPrice를 읽어 [0, PRICE_MAX] 범위를 벗어나거나 숫자가 아니면 null(기본값 사용).
function parsePriceQueryParam(raw: string | null): number | null {
  if (raw == null) return null;
  const v = Number(raw);
  return Number.isFinite(v) && v >= 0 && v <= PRICE_MAX ? v : null;
}

type LoadState = "loading" | "error" | "ready";

export default function SearchDashboardPage() {
  return (
    <Suspense fallback={null}>
      <SearchDashboard />
    </Suspense>
  );
}

function SearchDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const q = searchParams.get("q")?.trim() || "";
  const authStatus = useUserStore((s) => s.status);
  // cardId -> watchlistId. 홈 화면(app/page.tsx)과 동일한 패턴 — 하트 채움 여부도 이 Map으로
  // 판정하고, 삭제 시 필요한 watchlistId도 함께 들고 있는다.
  const [myWatchlist, setMyWatchlist] = useState<Map<number, number>>(new Map());
  const [watchlistError, setWatchlistError] = useState<{ cardId: number; message: string } | null>(
    null,
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const { toggle: toggleWatchlist, pendingCardId: watchlistPendingCardId } =
    useQuickWatchlistToggle();
  const [priceMin, setPriceMin] = useState<number>(() => {
    const min = parsePriceQueryParam(searchParams.get("minPrice"));
    const max = parsePriceQueryParam(searchParams.get("maxPrice"));
    return min != null ? Math.min(min, max ?? PRICE_MAX) : 0;
  });
  const [priceMax, setPriceMax] = useState<number>(() => {
    const min = parsePriceQueryParam(searchParams.get("minPrice"));
    const max = parsePriceQueryParam(searchParams.get("maxPrice"));
    return max != null ? Math.max(max, min ?? 0) : PRICE_MAX;
  });
  // min/max 핸들이 겹쳐 있을 때(값이 근접) 마지막으로 조작한 쪽이 위로 오도록
  // z-index를 정하는 데만 쓰는 state — null이면 기존처럼 max가 위(기본 동작).
  const [activeHandle, setActiveHandle] = useState<"min" | "max" | null>(null);
  // API 요청/URL 동기화용 디바운스된 값 — 라벨/thumb는 priceMin/priceMax(즉시값)를 그대로 쓰고,
  // 이 값은 드래그가 멈춘 뒤에만 갱신되어 재요청 트리거로 쓰인다.
  const [debouncedPriceMin, setDebouncedPriceMin] = useState(priceMin);
  const [debouncedPriceMax, setDebouncedPriceMax] = useState(priceMax);
  // facet 목록이 비동기로 오기 전이라 여기서는 화이트리스트 검증 없이 URL 값을 그대로 받는다.
  // facet 응답이 도착하면(아래 facet fetch effect) 그 시점에 존재하지 않는 값만 걸러낸다.
  const [selectedExpansionId, setSelectedExpansionId] = useState<string | null>(
    () => searchParams.get("expansionId") || null,
  );
  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    () => searchParams.get("types")?.split(",").filter(Boolean) ?? [],
  );
  const [selectedRarities, setSelectedRarities] = useState<string[]>(
    () => searchParams.get("rarity")?.split(",").filter(Boolean) ?? [],
  );
  // 언어(국가판) 필터 — 세트/타입/레어도와 달리 facets API에 옵션 목록이 없어(#263 범위 밖) 값
  // 화이트리스트 보정을 하지 않는다. 체크박스 자체가 EN/JA로만 고정돼 있어(SearchResultsView의
  // LANGUAGE_OPTIONS) 화면에서 다른 값이 선택될 수 없고, BE도 어차피 그대로 IN절로 필터링한다.
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(
    () => searchParams.get("languages")?.split(",").filter(Boolean) ?? [],
  );
  const [facets, setFacets] = useState<CardFacetsResponse>(EMPTY_FACETS);
  const [facetsLoading, setFacetsLoading] = useState(true);
  // BE 화이트리스트에 없는 값은 기본값(popular)으로 취급 — /api/cards/search(키워드 검색)는
  // sort를 지원하지 않으므로 q가 있을 때는 드롭다운 자체를 숨긴다.
  // priceAsc/priceDesc는 BE 화이트리스트에 없는 FE 전용 값(constants.ts의 UiSort 참고) — URL
  // 복원 시에도 그대로 인식해야 새로고침 후에도 가격순 선택이 유지된다.
  const [sort, setSort] = useState<UiSort>(() => {
    const s = searchParams.get("sort");
    return s === "name" || s === "latest" || s === "priceAsc" || s === "priceDesc" ? s : "popular";
  });
  // BE에 실제로 보내는 정렬값 — 가격순은 BE 화이트리스트에 없어(위 import의 isPriceSort 참고)
  // 그대로 보내면 조용히 latest로 폴백돼 "선택했는데 안 바뀐" 것처럼 보인다. 대신 기본 정렬(popular)로
  // 받아온 페이지를 SearchResultsView가 클라이언트에서 가격 기준으로 다시 정렬한다.
  const apiSort: CardSort = isPriceSort(sort) ? "popular" : sort;
  // 1-indexed(화면 표시용). BE 호출 시에만 0-indexed로 변환한다.
  const [page, setPage] = useState<number>(() => {
    const p = Number(searchParams.get("page"));
    return Number.isInteger(p) && p > 1 ? p : 1;
  });
  const [cards, setCards] = useState<CardSearchItem[]>([]);
  const [priceSummaries, setPriceSummaries] = useState<Map<number, CardPriceSummaryResponse>>(
    new Map(),
  );
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  // 키워드 검색(q)에서 정확 일치 결과가 없어 유사검색으로 대체됐는지(#187) — 필터 검색/연관
  // 카드 경로는 애초에 계산 자체를 하지 않아(아래 fetch effect의 q 분기 참고) 항상 false로
  // 남는다. BE가 "필터 검색은 항상 fuzzyMatch:false"라고 보장하더라도 그 값을 그대로 믿지 않고
  // FE에서 한 번 더 q로 걸러내, 안내 문구가 키워드 검색 결과에만 뜨도록 이중으로 막는다.
  const [hasFuzzyMatch, setHasFuzzyMatch] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);

  const [prevQ, setPrevQ] = useState(q);
  if (q !== prevQ) {
    setPrevQ(q);
    setLoadState("loading");
    setPage(1);
    // 키워드 검색으로 전환되면 필터 패널 자체가 사라지므로, 열려 있던
    // 바텀시트/드로어와 body 스크롤 잠금도 같이 정리한다.
    if (q) setFilterOpen(false);
  }

  // 정렬/필터가 바뀌면 이전 페이지 번호가 새 결과 집합에 더는 유효하지 않으므로 1페이지로 되돌린다.
  // 가격대는 debounced 값 기준 — 드래그 중간값으로 매번 1페이지/로딩 상태가 흔들리지 않도록 함.
  // (다른 필터는 각 onChange에서 이미 setLoadState("loading")을 즉시 호출하므로 여기서 또
  // 호출해도 중복일 뿐 해가 없고, debounced 가격 변경은 이 지점이 유일한 트리거가 된다.)
  const filterKey = `${selectedExpansionId}|${selectedTypes.join(",")}|${selectedRarities.join(",")}|${selectedLanguages.join(",")}|${apiSort}|${debouncedPriceMin}|${debouncedPriceMax}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setLoadState("loading");
    setPage(1);
  }

  // 필터 UI(세트/타입/레어도) 옵션 목록 — 마운트 시 한 번만 조회한다.
  // 실패해도 EMPTY_FACETS 기본값을 유지하고 조용히 넘어간다(필터 체크박스만 빈 상태로 남고
  // 나머지 화면은 정상 동작) — 이미 URL에 있던 선택값도 이 경우 그대로 유지한다.
  useEffect(() => {
    let cancelled = false;
    fetchCardFacets()
      .then((data) => {
        if (cancelled) return;
        // BE가 필드를 null로 내려줘도(예: 해당 세트/타입 데이터가 없는 경우) 렌더링이
        // 죽지 않도록 빈 배열로 보정한 뒤 상태에 반영한다.
        const safeData: CardFacetsResponse = {
          types: data.types ?? [],
          rarities: data.rarities ?? [],
          expansions: data.expansions ?? [],
        };
        setFacets(safeData);
        // URL 직접 조작 등으로 들어온, facet에 실제로 없는 선택값만 걸러낸다.
        setSelectedExpansionId((id) =>
          id && safeData.expansions.some((e) => e.id === id) ? id : null,
        );
        setSelectedTypes((types) =>
          types.filter((t) => safeData.types.some((opt) => opt.value === t)),
        );
        setSelectedRarities((rarities) =>
          rarities.filter((r) => safeData.rarities.some((opt) => opt.value === r)),
        );
      })
      .catch(() => {
        // 무시 — facets는 EMPTY_FACETS로 남고 필터 체크박스 목록만 비어 보인다.
      })
      .finally(() => {
        if (!cancelled) setFacetsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 로그인 상태가 확정되면 내 워치리스트 전체를 한 번 불러와 하트 채움 여부/삭제용 id를 안다
  // (app/page.tsx와 동일한 패턴). 비로그인이면 빈 Map으로 남겨 하트가 전부 빈 상태로 보이게
  // 한다(클릭하면 로그인으로 유도됨).
  useEffect(() => {
    if (authStatus !== "authenticated") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 로그아웃 시 직전 사용자의 워치리스트 흔적을 즉시 비운다.
      setMyWatchlist(new Map());
      return;
    }
    let cancelled = false;

    fetchWatchlist()
      .then((list) => {
        if (!cancelled) setMyWatchlist(new Map(list.map((w) => [w.cardId, w.id])));
      })
      .catch(() => {
        // 조회 실패는 조용히 무시 — 하트는 빈 상태로 보이고, 실제 등록 시도 자체는 그대로 동작한다.
      });

    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  // 가격 슬라이더는 드래그 중 priceMin/priceMax가 연속으로 바뀌므로, 300~500ms 동안
  // 값이 안정된 뒤에야 debouncedPriceMin/Max를 갱신한다 — API 요청/URL 동기화는 이 값을 본다.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPriceMin(priceMin);
      setDebouncedPriceMax(priceMax);
    }, 400);
    return () => clearTimeout(timer);
  }, [priceMin, priceMax]);

  useEffect(() => {
    let cancelled = false;

    // #308: q(키워드)와 필터를 항상 같이 보낸다 — BE가 q 없으면 기존 필터 전용 검색과
    // 동일하게 동작하므로 q 유무로 호출을 분기할 필요가 없어졌다.
    fetchCardsPage({
      q: q || undefined,
      expansionId: selectedExpansionId ?? undefined,
      types: selectedTypes,
      rarity: selectedRarities,
      languages: selectedLanguages,
      minPrice: debouncedPriceMin > 0 ? debouncedPriceMin : undefined,
      maxPrice: debouncedPriceMax < PRICE_MAX ? debouncedPriceMax : undefined,
      sort: apiSort,
      page: page - 1,
      size: MARKET_PAGE_SIZE,
    })
      .then((response) => {
        if (cancelled) return;
        setCards(response.content.map(toCardSearchItem));
        setTotalPages(response.totalPages);
        setTotalElements(response.totalElements);
        setHasFuzzyMatch(q ? response.content.some((c) => c.fuzzyMatch) : false);
        setLoadState("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMessage(err instanceof ApiError ? err.message : "카드 목록을 불러오지 못했습니다.");
        setLoadState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [
    reloadKey,
    selectedExpansionId,
    selectedTypes,
    selectedRarities,
    selectedLanguages,
    debouncedPriceMin,
    debouncedPriceMax,
    apiSort,
    page,
    q,
  ]);

  // 화면에 보이는 카드가 바뀔 때마다(필터/정렬/페이지 전환 포함) 가격을 한 번에 배치 조회한다.
  // 가격 조회 실패는 카드 목록 자체를 막지 않고, 실패한 카드는 기존처럼 "가격 정보 없음"으로 남는다.
  useEffect(() => {
    if (cards.length === 0) return;
    let cancelled = false;

    fetchPriceSummaries(
      cards.map((c) => c.id),
      { grade: "S", includeRecentTradePrice: true },
    )
      .then((summaries) => {
        if (!cancelled) setPriceSummaries(summaries);
      })
      .catch(() => {
        // 가격 조회 실패는 조용히 무시 — 카드 목록은 이미 정상 표시된 상태를 유지한다.
      });

    return () => {
      cancelled = true;
    };
  }, [cards]);

  // 필터가 좁아져 현재 페이지가 범위를 벗어나면(예: URL을 page=999로 직접 수정) 마지막 페이지로 보정.
  if (loadState === "ready" && totalPages > 0 && page > totalPages) {
    setPage(totalPages);
  }

  // 카드 상세 페이지의 "검색으로 돌아가기" 링크가 참조할 현재 검색 URL을 저장.
  // Link 클릭(클라이언트 사이드 라우팅)은 document.referrer를 갱신하지 않으므로 sessionStorage를 사용.
  useEffect(() => {
    const qs = searchParams.toString();
    sessionStorage.setItem("searchBackUrl", qs ? `${pathname}?${qs}` : pathname);
  }, [pathname, searchParams]);

  // 모바일 필터 드로어 열림 중 ESC 닫기 + 배경 스크롤 방지 (라이트박스와 공용 훅).
  useEscapeAndScrollLock(filterOpen, () => setFilterOpen(false));

  // 필터 상태를 URL 쿼리 파라미터에 반영 — 상세 페이지 진입 후 뒤로가기 시 필터가 유지되도록 함.
  // 세터 호출 지점마다 흩어져 있던 동기화 호출을 걷어내고, 필터 상태 변화를 감시하는
  // 단일 effect로 모아서 처리한다.
  // #308 이전에는 q가 있으면 필터 파라미터를 URL에서 지웠다(BE가 필터 없이 키워드만 받았기
  // 때문) — 이제 BE가 q+필터를 함께 받으므로 그 분기를 없애고 항상 필터를 반영한다.
  // q는 여전히 deps에 포함한다 — 헤더의 "마켓" 링크처럼 이 컴포넌트 바깥에서 q 없이 /search로만
  // 이동하는 순수 네비게이션은 이 effect를 거치지 않고 URL을 통째로 갈아치운다. 그 경우에도
  // selectedTypes 등 필터 상태 자체는 남아있어 화면은 필터가 적용된 채로 보이지만, URL만
  // 그 상태를 잃어버려 새로고침/공유 시 조용히 사라졌다(#187) — q 변화(진입/이탈 모두)를 감지해
  // 그 시점의 실제 필터 상태를 다시 반영해야 이 불일치를 막을 수 있다.
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (selectedExpansionId) params.set("expansionId", selectedExpansionId);
    else params.delete("expansionId");
    if (selectedTypes.length) params.set("types", selectedTypes.join(","));
    else params.delete("types");
    if (selectedRarities.length) params.set("rarity", selectedRarities.join(","));
    else params.delete("rarity");
    if (selectedLanguages.length) params.set("languages", selectedLanguages.join(","));
    else params.delete("languages");
    if (debouncedPriceMin > 0) params.set("minPrice", String(debouncedPriceMin));
    else params.delete("minPrice");
    if (debouncedPriceMax < PRICE_MAX) params.set("maxPrice", String(debouncedPriceMax));
    else params.delete("maxPrice");
    if (sort !== "popular") params.set("sort", sort);
    else params.delete("sort");
    if (page > 1) params.set("page", String(page));
    else params.delete("page");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    q,
    selectedExpansionId,
    selectedTypes,
    selectedRarities,
    selectedLanguages,
    debouncedPriceMin,
    debouncedPriceMax,
    sort,
    page,
  ]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage((cur) => (cur === message ? null : cur));
    }, 2500);
  };

  const handleHeartClick = async (cardId: number) => {
    setWatchlistError(null);
    const watchlistId = myWatchlist.get(cardId) ?? null;
    const result = await toggleWatchlist(cardId, watchlistId);
    if (result.status === "added") {
      setMyWatchlist((m) => new Map(m).set(cardId, result.watchlistId));
      showToast("관심 등록했습니다");
    } else if (result.status === "removed") {
      setMyWatchlist((m) => {
        const next = new Map(m);
        next.delete(cardId);
        return next;
      });
      showToast("관심 해제했습니다");
    } else if (result.status === "error") {
      setWatchlistError({ cardId, message: result.message });
      setTimeout(() => {
        setWatchlistError((cur) => (cur?.cardId === cardId ? null : cur));
      }, 3000);
    }
  };

  // 페이지 번호/이전·다음 버튼 클릭 시에만 맨 위로 스크롤 — 필터/정렬 변경으로
  // 인한 자동 setPage(1)은 이 핸들러를 거치지 않으므로 스크롤 동작이 없다.
  const goToPage = (p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // 슬라이더 드래그가 아닌 즉시 액션(초기화, 칩 제거)은 debounce를 기다리지 않고
  // priceMin/priceMax와 debouncedPriceMin/Max를 한 번에 맞춰 바로 재요청되게 한다.
  const setPriceRangeNow = (min: number, max: number) => {
    setPriceMin(min);
    setPriceMax(max);
    setDebouncedPriceMin(min);
    setDebouncedPriceMax(max);
  };

  const resetFilters = () => {
    setPriceRangeNow(0, PRICE_MAX);
    setActiveHandle(null);
    setLoadState("loading");
    setSelectedExpansionId(null);
    setSelectedTypes([]);
    setSelectedRarities([]);
    setSelectedLanguages([]);
    setSort("popular");
    setPage(1);
    // 필터가 이미 초기값이면 위 세터들이 상태를 바꾸지 않아 카드 목록 effect가
    // 재실행되지 않는다 — reloadKey를 강제로 올려 항상 재요청되게 한다.
    setReloadKey((k) => k + 1);
  };
  // 기존 SET_OPTIONS과 같은 모양({label, expansionId})으로 맞춰서, 이 값을 쓰는
  // SearchResultsView 쪽 JSX(옵션 렌더링/칩 라벨 조회)를 그대로 재사용한다.
  // series는 BE가 null이면 "기타"로 고정해서 내려주지만, 위쪽 safeData 보정과 같은 이유로
  // 한 번 더 방어해둔다. count(#263)는 그대로 실어 날라서 옵션 라벨 옆 개수 배지에 쓴다.
  const setOptions = facets.expansions.map((e) => ({
    label: e.name,
    expansionId: e.id,
    series: e.series ?? "기타",
    count: e.count,
  }));

  return (
    <main className="main-content bg-neutral px-4 pb-14 pt-8 sm:px-10">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-6 rounded-2xl border border-[#EDEDF0] bg-white p-5 shadow-card">
          <h1 className="m-0 mb-4 text-[26px] font-extrabold tracking-[-0.6px]">
            {q ? `"${q}" 검색 결과` : "카드 검색"}
          </h1>
          <SearchBar width="w-full" variant="market" />
        </div>

        <SearchResultsView
          q={q}
          filterOpen={filterOpen}
          setFilterOpen={setFilterOpen}
          selectedExpansionId={selectedExpansionId}
          setSelectedExpansionId={setSelectedExpansionId}
          selectedTypes={selectedTypes}
          setSelectedTypes={setSelectedTypes}
          selectedRarities={selectedRarities}
          setSelectedRarities={setSelectedRarities}
          selectedLanguages={selectedLanguages}
          setSelectedLanguages={setSelectedLanguages}
          setOptions={setOptions}
          typeOptions={facets.types}
          rarityOptions={facets.rarities}
          facetsLoading={facetsLoading}
          priceMin={priceMin}
          setPriceMin={setPriceMin}
          priceMax={priceMax}
          setPriceMax={setPriceMax}
          setPriceRangeNow={setPriceRangeNow}
          activeHandle={activeHandle}
          setActiveHandle={setActiveHandle}
          sort={sort}
          setSort={setSort}
          setLoadState={setLoadState}
          loadState={loadState}
          errorMessage={errorMessage}
          cards={cards}
          hasFuzzyMatch={hasFuzzyMatch}
          priceSummaries={priceSummaries}
          totalElements={totalElements}
          totalPages={totalPages}
          page={page}
          goToPage={goToPage}
          resetFilters={resetFilters}
          setReloadKey={setReloadKey}
          myWatchlist={myWatchlist}
          watchlistPendingCardId={watchlistPendingCardId}
          watchlistError={watchlistError}
          onHeartClick={handleHeartClick}
        />
      </div>
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-5 py-3 text-[13.5px] font-bold text-white shadow-lg"
        >
          {toastMessage}
        </div>
      )}
    </main>
  );
}
