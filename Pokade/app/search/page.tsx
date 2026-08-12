"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CardFacetsResponse, CardSearchItem, toCardSearchItem } from "@/types/card";
import { CardPriceSummaryResponse } from "@/types/price";
import {
  CardSort,
  fetchCardFacets,
  fetchCardsByKeywordPage,
  fetchCardsPage,
  fetchPriceSummaries,
} from "@/lib/cardApi";
import { ApiError } from "@/lib/apiClient";
import { useEscapeAndScrollLock } from "@/hooks/useEscapeAndScrollLock";
import { PRICE_MAX } from "./constants";
import SearchResultsView from "./SearchResultsView";
import PriceDashboardView from "./PriceDashboardView";

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
  const [view, setView] = useState<"search" | "dash">("search");
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
  const [facets, setFacets] = useState<CardFacetsResponse>(EMPTY_FACETS);
  const [facetsLoading, setFacetsLoading] = useState(true);
  // BE 화이트리스트에 없는 값은 latest로 취급 — /api/cards/search(키워드 검색)는
  // sort를 지원하지 않으므로 q가 있을 때는 드롭다운 자체를 숨긴다.
  const [sort, setSort] = useState<CardSort>(() => {
    const s = searchParams.get("sort");
    return s === "name" || s === "popular" ? s : "latest";
  });
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
  const filterKey = `${selectedExpansionId}|${selectedTypes.join(",")}|${selectedRarities.join(",")}|${sort}|${debouncedPriceMin}|${debouncedPriceMax}`;
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
        setFacets(data);
        // URL 직접 조작 등으로 들어온, facet에 실제로 없는 선택값만 걸러낸다.
        setSelectedExpansionId((id) =>
          id && data.expansions.some((e) => e.id === id) ? id : null,
        );
        setSelectedTypes((types) => types.filter((t) => data.types.includes(t)));
        setSelectedRarities((rarities) => rarities.filter((r) => data.rarities.includes(r)));
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

    const request = q
      ? fetchCardsByKeywordPage(q, page - 1)
      : fetchCardsPage({
          expansionId: selectedExpansionId ?? undefined,
          types: selectedTypes,
          rarity: selectedRarities,
          minPrice: debouncedPriceMin > 0 ? debouncedPriceMin : undefined,
          maxPrice: debouncedPriceMax < PRICE_MAX ? debouncedPriceMax : undefined,
          sort,
          page: page - 1,
        });

    request
      .then((response) => {
        if (cancelled) return;
        setCards(response.content.map(toCardSearchItem));
        setTotalPages(response.totalPages);
        setTotalElements(response.totalElements);
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
    debouncedPriceMin,
    debouncedPriceMax,
    sort,
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
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (selectedExpansionId) params.set("expansionId", selectedExpansionId);
    else params.delete("expansionId");
    if (selectedTypes.length) params.set("types", selectedTypes.join(","));
    else params.delete("types");
    if (selectedRarities.length) params.set("rarity", selectedRarities.join(","));
    else params.delete("rarity");
    if (debouncedPriceMin > 0) params.set("minPrice", String(debouncedPriceMin));
    else params.delete("minPrice");
    if (debouncedPriceMax < PRICE_MAX) params.set("maxPrice", String(debouncedPriceMax));
    else params.delete("maxPrice");
    if (sort !== "latest") params.set("sort", sort);
    else params.delete("sort");
    if (page > 1) params.set("page", String(page));
    else params.delete("page");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedExpansionId,
    selectedTypes,
    selectedRarities,
    debouncedPriceMin,
    debouncedPriceMax,
    sort,
    page,
  ]);

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
    setSort("latest");
    setPage(1);
    // 필터가 이미 초기값이면 위 세터들이 상태를 바꾸지 않아 카드 목록 effect가
    // 재실행되지 않는다 — reloadKey를 강제로 올려 항상 재요청되게 한다.
    setReloadKey((k) => k + 1);
  };
  const seg = (a: boolean) =>
    `rounded-lg px-[18px] py-[9px] text-[13.5px] cursor-pointer ${a ? "bg-white font-bold text-ink shadow-[0_1px_3px_rgba(0,0,0,0.08)]" : "bg-transparent font-semibold text-[#8A8A92]"}`;

  // 기존 SET_OPTIONS과 같은 모양({label, expansionId})으로 맞춰서, 이 값을 쓰는
  // SearchResultsView 쪽 JSX(옵션 렌더링/칩 라벨 조회)를 그대로 재사용한다.
  const setOptions = facets.expansions.map((e) => ({ label: e.name, expansionId: e.id }));

  return (
    <main className="main-content bg-neutral px-4 pb-14 pt-8 sm:px-10">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-[22px] flex items-center justify-between">
          <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.6px]">
            {q ? `"${q}" 검색 결과` : "카드 검색 & 시세"}
          </h1>
          {!q && (
            <div className="flex rounded-[10px] bg-[#EDEDF0] p-1">
              <button className={seg(view === "search")} onClick={() => setView("search")}>
                카드 검색
              </button>
              <button className={seg(view === "dash")} onClick={() => setView("dash")}>
                시세 대시보드
              </button>
            </div>
          )}
        </div>

        {(q || view === "search") && (
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
            priceSummaries={priceSummaries}
            totalElements={totalElements}
            totalPages={totalPages}
            page={page}
            goToPage={goToPage}
            resetFilters={resetFilters}
            setReloadKey={setReloadKey}
          />
        )}

        {!q && view === "dash" && <PriceDashboardView />}
      </div>
    </main>
  );
}
