import { Dispatch, FormEvent, SetStateAction, useEffect, useRef, useState } from "react";
import Link from "next/link";
import CardImage from "@/components/CardImage";
import IconTooltip from "@/components/IconTooltip";
import { useHeartPunch } from "@/hooks/useHeartPunch";
import { QuickWatchlistToggleStatus } from "@/hooks/useQuickWatchlistToggle";
import { CardFacetOption, CardSearchItem } from "@/types/card";
import { CardPriceSummaryResponse } from "@/types/price";
import { highlightMatch } from "@/lib/highlightMatch";
import { pickDisplayName } from "@/lib/pickDisplayName";
import { PriceBasis, resolvePriceDisplay, resolveSortablePrice } from "@/lib/priceDisplay";
import { isPriceSort, LANGUAGE_OPTIONS, MARKET_PAGE_SIZE, PRICE_MAX, UiSort } from "./constants";
import SearchFilterSidebar from "./SearchFilterSidebar";

type LoadState = "loading" | "error" | "ready";

// page.tsx가 실제로 요청하는 페이지 size(MARKET_PAGE_SIZE, #187)와 맞춘 스켈레톤 칸 수.
const SEARCH_SKELETON_COUNT = MARKET_PAGE_SIZE;

// 검색 타일 가격 아래 보조텍스트(#238 UX-2). 사용자에게 중요한 건 값의 출처가 아니라 "지금 살
// 수 있는지"라, recentTrade(우리 플랫폼 최근 체결가)와 market(외부 참고 시세)은 둘 다 "매물이
// 아닌 참고값"이므로 "참고 가격" 하나로 합친다 — 값 자체는 그대로 보여주고 라벨만 통일한다.
// S등급(ACTIVE 매물)만 실제 구매 가능한 값이라 별도로 남겨 칩으로 강조한다.
// 홈/워치리스트 등 다른 화면은 여전히 resolvePriceDisplay의 label을 쓰므로 이 매핑과 무관하다.
const BASIS_BADGE_LABEL: Record<PriceBasis, string> = {
  sGrade: "S등급",
  recentTrade: "참고 가격",
  market: "참고 가격",
};

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-[#DDDDE3] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#4B4B52]">
      {label}
      <button
        onClick={onRemove}
        aria-label={`${label} 필터 해제`}
        className="flex h-4 w-4 items-center justify-center rounded-full text-[#9A9AA2] hover:bg-[#F2F2F5] hover:text-ink"
      >
        ×
      </button>
    </span>
  );
}

interface SearchResultsViewProps {
  q: string;
  filterOpen: boolean;
  setFilterOpen: Dispatch<SetStateAction<boolean>>;
  selectedExpansionId: string | null;
  setSelectedExpansionId: Dispatch<SetStateAction<string | null>>;
  selectedTypes: string[];
  setSelectedTypes: Dispatch<SetStateAction<string[]>>;
  selectedRarities: string[];
  setSelectedRarities: Dispatch<SetStateAction<string[]>>;
  selectedLanguages: string[];
  setSelectedLanguages: Dispatch<SetStateAction<string[]>>;
  setOptions: { label: string; expansionId: string; series: string; count: number }[];
  typeOptions: CardFacetOption[];
  rarityOptions: CardFacetOption[];
  facetsLoading: boolean;
  priceMin: number;
  setPriceMin: Dispatch<SetStateAction<number>>;
  priceMax: number;
  setPriceMax: Dispatch<SetStateAction<number>>;
  setPriceRangeNow: (min: number, max: number) => void;
  activeHandle: "min" | "max" | null;
  setActiveHandle: Dispatch<SetStateAction<"min" | "max" | null>>;
  sort: UiSort;
  setSort: Dispatch<SetStateAction<UiSort>>;
  setLoadState: Dispatch<SetStateAction<LoadState>>;
  loadState: LoadState;
  errorMessage: string;
  cards: CardSearchItem[];
  hasFuzzyMatch: boolean;
  priceSummaries: Map<number, CardPriceSummaryResponse>;
  totalElements: number;
  totalPages: number;
  page: number;
  goToPage: (p: number) => void;
  resetFilters: () => void;
  setReloadKey: Dispatch<SetStateAction<number>>;
  myWatchlist: Map<number, number>;
  watchlistPendingCardId: number | null;
  watchlistError: { cardId: number; message: string } | null;
  // 등록/해제 결과를 돌려받아야 "등록 확정" 시에만 하트 펀치를 재생할 수 있다.
  onHeartClick: (cardId: number) => Promise<QuickWatchlistToggleStatus | null>;
}

// 페이지네이션 블록 — 현재 페이지가 속한 5개 구간을 통째로 노출하고, 양 끝 «/» 버튼으로 블록
// 단위로 건너뛴다(21페이지면 21~25를 그리고 «는 16, »는 26으로 이동). 이전에는 현재 페이지 주변
// 몇 개 + 마지막 페이지만("1 2 3 4 5 ... 1413") 보여줬는데, 1400페이지가 넘는 카탈로그에서는
// 한 번에 옮겨갈 수 있는 거리가 너무 짧아 블록 방식으로 바꿨다.
// 이 화면(카탈로그 탐색)만 번호 방식을 쓴다 — MyTradesSection.tsx/notifications 전체보기처럼
// 시간순으로 훑어보는 개인 활동 피드는 임의 페이지 점프가 필요 없어 components/Pagination.tsx의
// 단순 prev/next를 쓴다. 페이지 수보다 "탐색 vs 피드"라는 화면 성격 차이가 기준이라 이 둘을
// 하나의 컴포넌트로 통합하지 않는다.
const PAGE_BLOCK_SIZE = 5;

interface PageBlock {
  pages: number[];
  prevBlockPage: number | null; // 이전 블록의 첫 페이지(첫 블록이면 null)
  nextBlockPage: number | null; // 다음 블록의 첫 페이지(마지막 블록이면 null)
}

// current/total이 0·음수·소수·NaN으로 들어와도(로딩 직후 totalPages=0, URL 직접 조작 등) 빈
// 배열이나 깨진 번호를 그리지 않도록 1 이상 정수로 보정한 뒤 계산한다.
function getPageBlock(current: number, total: number): PageBlock {
  const safeTotal = Number.isFinite(total) ? Math.max(1, Math.floor(total)) : 1;
  const safeCurrent = Number.isFinite(current)
    ? Math.min(Math.max(1, Math.floor(current)), safeTotal)
    : 1;
  const start = Math.floor((safeCurrent - 1) / PAGE_BLOCK_SIZE) * PAGE_BLOCK_SIZE + 1;
  const end = Math.min(start + PAGE_BLOCK_SIZE - 1, safeTotal);
  return {
    pages: Array.from({ length: end - start + 1 }, (_, i) => start + i),
    prevBlockPage: start > 1 ? start - PAGE_BLOCK_SIZE : null,
    nextBlockPage: end < safeTotal ? end + 1 : null,
  };
}

// 페이지네이션 버튼 공통 스타일 — 번호/한 페이지 이동/블록 이동이 모두 같은 크기·모양을 쓴다.
// 최대 9개(블록 2 + 화살표 2 + 번호 5)가 늘어서므로 360px에서는 한 줄에 못 담을 수 있다. 가로
// 스크롤은 스크롤바가 보이지 않아 발견성이 나빠, 아래 컨테이너의 flex-wrap으로 줄을 넘기고
// sm 미만에서는 버튼을 한 단계 작게(32px) 잡아 줄 수를 줄인다.
const PAGE_BUTTON_SIZE_CLASS =
  "h-8 w-8 rounded-[9px] text-[12px] font-bold sm:h-9 sm:w-9 sm:text-[13px]";
const PAGE_NAV_BUTTON_CLASS = `flex items-center justify-center border border-[#DDDDE3] bg-white text-[#4B4B52] enabled:hover:border-primary enabled:hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 ${PAGE_BUTTON_SIZE_CLASS}`;

// /search의 "카드 검색" 탭 — 필터 사이드바/드로어 + 검색 결과 그리드 + 페이지네이션.
export default function SearchResultsView({
  q,
  filterOpen,
  setFilterOpen,
  selectedExpansionId,
  setSelectedExpansionId,
  selectedTypes,
  setSelectedTypes,
  selectedRarities,
  setSelectedRarities,
  selectedLanguages,
  setSelectedLanguages,
  setOptions,
  typeOptions,
  rarityOptions,
  facetsLoading,
  priceMin,
  setPriceMin,
  priceMax,
  setPriceMax,
  setPriceRangeNow,
  activeHandle,
  setActiveHandle,
  sort,
  setSort,
  setLoadState,
  loadState,
  errorMessage,
  cards,
  hasFuzzyMatch,
  priceSummaries,
  totalElements,
  totalPages,
  page,
  goToPage,
  resetFilters,
  setReloadKey,
  myWatchlist,
  watchlistPendingCardId,
  watchlistError,
  onHeartClick,
}: SearchResultsViewProps) {
  // 결과 0건일 때 "검색어 탓"과 "필터 탓"을 구분하기 위한 파생값(#238 UX-1). 예전에는 q 유무로만
  // 갈라, 검색어+필터로 0건이 나도 "다른 검색어로 시도해보세요"라고만 해서 실제 원인(필터)을
  // 가리키지 못했다. 가격대는 양끝이 기본값(0~PRICE_MAX)이면 필터가 걸린 것으로 보지 않는다.
  const hasActiveFilter =
    selectedTypes.length > 0 ||
    selectedRarities.length > 0 ||
    selectedLanguages.length > 0 ||
    selectedExpansionId != null ||
    priceMin > 0 ||
    priceMax < PRICE_MAX;

  const { triggerPunch, punchKey, punchClass } = useHeartPunch();
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const prevFilterOpenRef = useRef(filterOpen);
  // 페이지 직접 입력 — 블록 이동만으로도 1400페이지대까지는 280번을 눌러야 해서 함께 둔다.
  // 입력값은 문자열로 들고 있다가 제출 시점에만 검증한다(타이핑 중 "1"이 잠깐 유효/무효를
  // 오가며 안내 문구가 깜빡이지 않도록).
  const [pageInput, setPageInput] = useState("");
  const [pageInputError, setPageInputError] = useState("");
  // 필터/검색어가 바뀌어 전체 페이지 수가 달라지면 입력해 둔 번호도 안내 문구("1~N")도 더는
  // 맞지 않으므로 비운다 — 그대로 두면 이전 결과 기준의 범위를 안내하게 된다. effect 대신
  // 렌더 중 비교로 처리한다(page.tsx의 prevQ/prevFilterKey와 같은 방식).
  const [prevTotalPages, setPrevTotalPages] = useState(totalPages);
  if (totalPages !== prevTotalPages) {
    setPrevTotalPages(totalPages);
    setPageInput("");
    setPageInputError("");
  }

  useEffect(() => {
    if (filterOpen && !prevFilterOpenRef.current) {
      filterPanelRef.current?.focus();
    } else if (!filterOpen && prevFilterOpenRef.current) {
      filterButtonRef.current?.focus();
    }
    prevFilterOpenRef.current = filterOpen;
  }, [filterOpen]);

  // 가격순 — BE 화이트리스트에 없어(constants.ts의 UiSort 주석 참고) 서버 정렬 대신 이미 로드된
  // 현재 페이지 카드만 여기서 재정렬한다. 가격 정보가 없는 카드(priceDisplay가 null인 경우)는
  // 오름차순/내림차순 모두에서 항상 맨 뒤로 보낸다 — 가격이 없다는 사실 자체는 정렬 방향과 무관.
  const displayCards = isPriceSort(sort)
    ? [...cards].sort((a, b) => {
        const priceA = resolveSortablePrice(priceSummaries.get(a.id));
        const priceB = resolveSortablePrice(priceSummaries.get(b.id));
        if (priceA == null && priceB == null) return 0;
        if (priceA == null) return 1;
        if (priceB == null) return -1;
        return sort === "priceAsc" ? priceA - priceB : priceB - priceA;
      })
    : cards;

  const pageBlock = getPageBlock(page, totalPages);

  // 입력 → 이동. 이동 후 표시되는 블록은 page에서 파생되므로(getPageBlock) 해당 페이지가 속한
  // 5개 구간으로 자동 전환된다 — 블록을 따로 상태로 들고 있지 않는 이유.
  const submitPageInput = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = pageInput.trim();
    if (!trimmed) {
      setPageInputError("이동할 페이지 번호를 입력해 주세요.");
      return;
    }
    // onChange에서 숫자만 남기므로 여기 도달한 값은 항상 정수 문자열이지만, 범위는 여기서 본다.
    const target = Number(trimmed);
    if (!Number.isInteger(target) || target < 1 || target > totalPages) {
      setPageInputError(`1~${totalPages.toLocaleString("ko-KR")} 사이의 번호를 입력해 주세요.`);
      return;
    }
    setPageInputError("");
    setPageInput("");
    goToPage(target);
  };

  return (
    // lg:items-stretch(#235): items-start면 필터 쪽 그리드 아이템이 콘텐츠 높이에 딱 맞아
    // sticky가 움직일 여유(부모 높이 - 자기 높이)가 0이라 아예 고정되지 않는다. 데스크톱에서만
    // 행 높이만큼 늘려 sticky에 이동 구간을 준다(필터 카드 자체는 max-h가 있어 안 늘어난다).
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[250px_1fr] lg:items-stretch">
      {/* filter sidebar — #308: 키워드(q) 검색 중에도 필터를 함께 적용할 수 있어 항상 노출한다.
          lg 미만에서는 사이드바 대신 "필터" 버튼으로 여는 바텀시트/드로어로 표시.
          세트/타입/레어도/언어/가격대 필터 전체는 SearchFilterSidebar로 분리돼 있다(#142).
          필터와 결과(카드 목록+페이지네이션)는 각자 자기 카드 스타일을 갖는다(SearchFilterSidebar.tsx
          lg: 스타일, 아래 결과 컬럼 div 참고) — 이 grid 자체는 순수 레이아웃 컨테이너로만 쓴다. */}
      <SearchFilterSidebar
        filterOpen={filterOpen}
        setFilterOpen={setFilterOpen}
        filterPanelRef={filterPanelRef}
        selectedExpansionId={selectedExpansionId}
        setSelectedExpansionId={setSelectedExpansionId}
        selectedTypes={selectedTypes}
        setSelectedTypes={setSelectedTypes}
        selectedRarities={selectedRarities}
        setSelectedRarities={setSelectedRarities}
        selectedLanguages={selectedLanguages}
        setSelectedLanguages={setSelectedLanguages}
        setOptions={setOptions}
        typeOptions={typeOptions}
        rarityOptions={rarityOptions}
        facetsLoading={facetsLoading}
        priceMin={priceMin}
        setPriceMin={setPriceMin}
        priceMax={priceMax}
        setPriceMax={setPriceMax}
        activeHandle={activeHandle}
        setActiveHandle={setActiveHandle}
        setLoadState={setLoadState}
        resetFilters={resetFilters}
      />

      {/* results grid — 카드 목록+페이지네이션 전용 카드. 필터 사이드바(SearchFilterSidebar.tsx)와
          같은 톤(rounded-2xl/border-[#EDEDF0]/shadow-card)으로 나란히 놓인 별도 카드다. */}
      <div className="rounded-2xl border border-[#EDEDF0] bg-white p-6 shadow-card">
        {/* 오타 등으로 정확 일치 결과가 없어 유사검색으로 대체됐을 때만 노출(#187) — q가 없거나
            (필터 검색) 결과가 비어 있으면(빈 상태 문구가 대신 노출) 굳이 같이 보여줄 필요가 없다. */}
        {q && hasFuzzyMatch && loadState === "ready" && cards.length > 0 && (
          <div className="mb-4 rounded-[10px] bg-lavender px-3.5 py-2.5 text-[12.5px] font-semibold text-secondary">
            {`"${q}"에 대한 정확한 검색 결과가 없어, 비슷한 카드를 보여드려요.`}
          </div>
        )}

        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              ref={filterButtonRef}
              type="button"
              onClick={() => setFilterOpen(true)}
              className="flex items-center gap-1 rounded-[9px] border border-[#DDDDE3] bg-white px-3 py-2 text-[13px] font-bold text-[#4B4B52] lg:hidden"
            >
              필터
            </button>
            {/* 결과 개수(#238) — tabular-nums로 자릿수 폭을 고정해 필터를 바꿔 숫자가 갱신될 때
                (21,190 → 3,575) 좌우로 흔들리지 않게 한다. 시각적 강조는 일부러 넣지 않는다 —
                이 화면에서 눈에 띄어야 하는 건 검색창과 필터지 결과 개수가 아니다. */}
            <span className="text-[13.5px] text-[#8A8A92]">
              <b className="tabular-nums text-ink">
                {loadState === "ready"
                  ? totalElements.toLocaleString("ko-KR")
                  : cards.length > 0
                    ? cards.length
                    : "-"}
              </b>
              개의 카드
            </span>
          </div>
          {/* #308: 필터+키워드 통합 검색에도 BE가 sort를 그대로 받으므로 q 유무와 무관하게 노출한다. */}
          <select
            value={sort}
            onChange={(e) => {
              const next = e.target.value as UiSort;
              // priceAsc/priceDesc는 BE에 안 보내는 FE 전용 값이라 실제로는 둘 다 기본 정렬
              // (popular)로 조회한 뒤 클라이언트에서 재정렬만 한다 — popular↔priceAsc/priceDesc
              // 간 전환처럼 BE 요청이 실제로 바뀌지 않을 때 setLoadState("loading")을 부르면
              // 재요청이 없어 "ready"로 되돌아오지 못하고 로딩 상태에 그대로 갇힌다.
              const apiSortChanged =
                (isPriceSort(sort) ? "popular" : sort) !== (isPriceSort(next) ? "popular" : next);
              if (apiSortChanged) setLoadState("loading");
              setSort(next);
            }}
            aria-label="정렬 기준"
            className="cursor-pointer rounded-[9px] border border-[#DDDDE3] bg-white px-3 py-2 text-[13px] outline-none"
          >
            <option value="popular">인기순</option>
            <option value="latest">최신순</option>
            <option value="name">이름순</option>
            <option value="priceAsc">가격 낮은순</option>
            <option value="priceDesc">가격 높은순</option>
          </select>
        </div>

        {(selectedExpansionId ||
          selectedTypes.length > 0 ||
          selectedRarities.length > 0 ||
          selectedLanguages.length > 0 ||
          priceMin > 0 ||
          priceMax < PRICE_MAX) && (
          <div className="mb-4 flex flex-wrap gap-2">
            {selectedExpansionId && (
              <FilterChip
                label={
                  setOptions.find((o) => o.expansionId === selectedExpansionId)?.label ??
                  selectedExpansionId
                }
                onRemove={() => {
                  setLoadState("loading");
                  setSelectedExpansionId(null);
                }}
              />
            )}
            {selectedTypes.map((t) => (
              <FilterChip
                key={`type-${t}`}
                label={t}
                onRemove={() => {
                  setLoadState("loading");
                  setSelectedTypes(selectedTypes.filter((v) => v !== t));
                }}
              />
            ))}
            {selectedRarities.map((r) => (
              <FilterChip
                key={`rarity-${r}`}
                label={r}
                onRemove={() => {
                  setLoadState("loading");
                  setSelectedRarities(selectedRarities.filter((v) => v !== r));
                }}
              />
            ))}
            {selectedLanguages.map((l) => (
              <FilterChip
                key={`language-${l}`}
                label={LANGUAGE_OPTIONS.find((opt) => opt.value === l)?.label ?? l}
                onRemove={() => {
                  setLoadState("loading");
                  setSelectedLanguages(selectedLanguages.filter((v) => v !== l));
                }}
              />
            ))}
            {(priceMin > 0 || priceMax < PRICE_MAX) && (
              <FilterChip
                label={`${priceMin.toLocaleString("ko-KR")}원~${priceMax.toLocaleString("ko-KR")}원`}
                onRemove={() => setPriceRangeNow(0, PRICE_MAX)}
              />
            )}
          </div>
        )}

        {loadState === "loading" && cards.length === 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: SEARCH_SKELETON_COUNT }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col overflow-hidden rounded-[14px] border border-[#EDEDF0]"
              >
                <div className="skeleton-shimmer aspect-[5/7] w-full" />
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <div className="skeleton-shimmer h-[13.5px] w-3/4 rounded" />
                  <div className="skeleton-shimmer h-[11.5px] w-1/2 rounded" />
                  <div className="skeleton-shimmer mt-auto h-[15px] w-2/3 rounded" />
                </div>
              </div>
            ))}
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

        {/* 빈 결과 안내(#238 UX-1) — q(검색어)와 필터 활성 여부를 조합해 원인을 정확히 짚는다.
            초기화 버튼은 실제로 풀 필터가 있을 때(hasActiveFilter)만 노출한다: 검색어만으로 0건이면
            풀 필터가 없어 버튼이 무의미하고, 검색어는 이 버튼이 건드리지 않으므로(필터만 초기화)
            그대로 남는다. */}
        {loadState === "ready" && cards.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-[#EDEDF0] bg-white py-24">
            {q && hasActiveFilter ? (
              <>
                <span className="text-[13.5px] font-semibold text-[#8A8A92]">
                  필터와 검색어를 모두 만족하는 카드가 없어요.
                </span>
                <span className="text-[12.5px] text-[#9A9AA2]">
                  필터를 풀면 더 많은 결과를 볼 수 있어요.
                </span>
              </>
            ) : q ? (
              <>
                <span className="text-[13.5px] font-semibold text-[#8A8A92]">
                  {`"${q}"에 대한 검색 결과가 없습니다.`}
                </span>
                <span className="text-[12.5px] text-[#9A9AA2]">다른 검색어로 시도해보세요.</span>
              </>
            ) : (
              <>
                <span className="text-[13.5px] font-semibold text-[#8A8A92]">
                  선택한 필터에 맞는 카드가 없어요.
                </span>
                <span className="text-[12.5px] text-[#9A9AA2]">필터를 조정해보세요.</span>
              </>
            )}
            {hasActiveFilter && (
              <button
                onClick={resetFilters}
                className="mt-1.5 rounded-[9px] border-[1.5px] border-[#DDDDE3] bg-white px-4 py-2 text-[13px] font-bold text-[#4B4B52] hover:border-primary hover:text-primary"
              >
                필터 초기화
              </button>
            )}
          </div>
        )}

        {cards.length > 0 && loadState !== "error" && (
          <div
            className={`grid grid-cols-2 gap-4 transition-opacity duration-200 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 ${
              loadState === "loading" ? "pointer-events-none opacity-50" : "opacity-100"
            }`}
          >
            {displayCards.map((c) => {
              const priceDisplay = resolvePriceDisplay(priceSummaries.get(c.id));
              // "다른 등급도 있음" 힌트 개수 — S등급 상품가가 기준이면 S를 뺀 나머지 활성 매물
              // 등급만 "다른 등급"이고, 최근 체결가/참고시세가 기준이면(=활성 S등급 매물이 없다는
              // 뜻) 활성 매물이 있는 등급 전부가 화면에 보이는 값과는 다른 등급이다.
              const otherGradesCount = priceDisplay
                ? (priceDisplay.basis === "sGrade" ? c.grades.filter((g) => g !== "S") : c.grades)
                    .length
                : 0;
              // pickDisplayName이 받는 { name, nameKo } 형태로 원본 필드를 매핑한다 — 여기서
              // name은 병합된 c.name이 아니라 원본 영문명(c.nameEn)이어야 검색어와 정확히 대조된다.
              // Header.tsx는 CardResponse가 이미 이 형태라 그대로 넘기지만, CardSearchItem은
              // name을 이미 병합해둔 형태라 여기서만 별도로 매핑해 넘긴다.
              const rawNames = { name: c.nameEn, nameKo: c.nameKo };
              // alt와 화면 표시 텍스트가 항상 같은 언어를 가리키도록 한 번만 계산해 공유한다.
              const displayName = q ? pickDisplayName(rawNames, q) : c.name;
              return (
                <div
                  key={c.id}
                  className="relative flex flex-col overflow-hidden rounded-[14px] border border-[#EDEDF0] transition hover:-translate-y-1 hover:shadow-lift"
                >
                  {/* 링크 범위는 이미지+이름/세트/타입까지 — 가격 줄은 아래에서 Link 밖 형제로
                      분리했다(#235). 하트를 카드 아트 위에 겹치지 않게 가격 옆으로 옮기려면
                      하트가 <a> 안에 들어가면 안 되기 때문이다(interactive content 중첩 금지). */}
                  <Link href={`/cards/${c.id}`} className="flex cursor-pointer flex-col">
                    <div className="relative aspect-[5/7] w-full bg-[#F2F2F5]">
                      <CardImage src={c.imageUrl} alt={displayName} label="카드" />
                    </div>
                    <div className="flex flex-col p-3 pb-0">
                      {/* 줄 수 상한(#238) — 세트명("Burning Shadows · Rare Holo GX")이 2줄이 되면
                          그 카드가 속한 행 전체가 21px 커져 그리드가 행마다 들쭉날쭉했다(실측
                          404~446px). 잘린 값은 title로 hover 시 전체를 볼 수 있고 상세 페이지에도
                          그대로 있다. 가격 줄 위치는 mt-auto가 이미 바닥에 고정하고 있어 무관하다. */}
                      <div className="line-clamp-2 text-[13.5px] font-bold" title={displayName}>
                        {q ? highlightMatch(displayName, q) : displayName}
                      </div>
                      <div
                        className="mt-0.5 line-clamp-1 text-[11.5px] text-[#9A9AA2]"
                        title={c.set}
                      >
                        {c.set}
                      </div>
                      {/* EN(기본값)이 절대다수라 EN은 배지를 생략하고, 눈에 띄어야 하는 예외
                        (JA 등 비영어판)만 표시한다 — 대다수 카드에 불필요한 배지를 매번
                        노출하지 않으면서도 국가판이 다른 경우만 부각한다. */}
                      {c.languageCode !== "EN" && (
                        <span className="mt-1 inline-flex w-fit items-center rounded-full border border-[#DDDDE3] bg-white px-2 py-0.5 text-[10px] font-bold text-[#4B4B52]">
                          {c.languageCode}
                        </span>
                      )}
                      {c.types.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {c.types.map((t) => (
                            <span
                              key={t}
                              className="rounded-full border border-[#D4D9F5] bg-lavender px-2 py-0.5 text-[10px] font-bold text-secondary"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </Link>
                  {/* 가격 + 하트 한 줄 — Link 밖이라 <a> 안에 <button>이 중첩되지 않고,
                      하트를 눌러도 카드 상세로 새지 않는다. mt-auto가 이 줄에 있어야
                      타일 높이가 달라도 가격 줄이 항상 바닥에 붙는다. */}
                  <div className="mt-auto flex items-end justify-between gap-2 p-3 pt-2.5">
                    <div className="min-w-0">
                      {priceDisplay ? (
                        <>
                          {/* 설명 없이도 "지금 살 수 있는지"가 보이게 배지를 2단계로 나눈다(#238 UX-2).
                              S등급(ACTIVE 매물=구매 가능)만 강조색+연한 배경 칩으로 도드라지게 하고,
                              참고 가격(체결가·외부시세)은 무채색 텍스트로 둔다 — 색/배경 유무 자체가
                              "구매 가능 vs 참고용"을 가른다. "외 N개 등급"은 배지 밖 회색으로 빼서
                              칩이 상태만 담고 등급 개수와 뒤섞이지 않게 한다. */}
                          <div className="flex items-center gap-1">
                            {priceDisplay.basis === "sGrade" ? (
                              <span className="rounded bg-lavender px-1.5 py-0.5 text-[10.5px] font-bold text-secondary">
                                {BASIS_BADGE_LABEL.sGrade}
                              </span>
                            ) : (
                              <span className="text-[11px] text-[#9A9AA2]">
                                {BASIS_BADGE_LABEL[priceDisplay.basis]}
                              </span>
                            )}
                            {otherGradesCount > 0 && (
                              <span className="text-[11px] text-[#9A9AA2]">
                                외 {otherGradesCount}개 등급
                              </span>
                            )}
                          </div>
                          {/* 콘텐츠 폭 확대로 타일이 179 → 226px가 된 만큼 가격도 한 단계 올려
                              카드명(13.5px)과의 대비를 1.11배 → 1.26배로 키운다(#238). 라벨은
                              위 배지(S등급/참고 가격)가 이미 맡고 있어 새로 넣지 않는다. */}
                          <div className="mt-0.5 text-[17px] font-extrabold text-ink">
                            {priceDisplay.price}
                          </div>
                        </>
                      ) : (
                        <div className="text-[13px] font-semibold text-[#9A9AA2]">
                          가격 정보 없음
                        </div>
                      )}
                    </div>
                    {/* 시각 크기는 32px 그대로 두고 -m-1.5/p-1.5로 히트 영역만 44px로 넓힌다
                        (터치 타겟 최소 44px). 레이아웃에 영향이 없도록 음수 마진으로 상쇄한다. */}
                    {/* 툴팁은 위로 — 하트가 타일 맨 아래(가격 줄)에 있어 아래로 열면
                        타일의 overflow-hidden에 잘린다. */}
                    <IconTooltip
                      label={myWatchlist.has(c.id) ? "관심 해제" : "관심 등록"}
                      placement="top"
                      className="flex-shrink-0"
                    >
                      <button
                        type="button"
                        onClick={async () => {
                          // 서버가 등록을 확정한 뒤에만 펀치(useHeartPunch 주석 참고) —
                          // 클릭 시점 상태로 미리 재생하면 등록이 실패해도 하트가 튀어올라
                          // 성공한 것처럼 보인다.
                          if ((await onHeartClick(c.id)) === "added") triggerPunch(c.id);
                        }}
                        disabled={watchlistPendingCardId === c.id}
                        aria-label={myWatchlist.has(c.id) ? "관심 해제" : "관심 등록"}
                        className="-m-1.5 flex flex-shrink-0 items-center justify-center p-1.5 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#EDEDF0] bg-white transition hover:border-primary hover:bg-[#FFF5F5]">
                          <svg
                            key={punchKey(c.id)}
                            className={punchClass(c.id)}
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            stroke="#EE1515"
                            strokeWidth="2"
                            fill={myWatchlist.has(c.id) ? "#EE1515" : "none"}
                            aria-hidden="true"
                          >
                            <path
                              d="M19 14c1.5-1.5 3-3.3 3-5.5A3.5 3.5 0 0018.5 5c-1.6 0-3 1-3.5 2.5C14.5 6 13.1 5 11.5 5A3.5 3.5 0 008 8.5c0 2.2 1.5 4 3 5.5l4 4z"
                              transform="translate(-3 0)"
                            />
                          </svg>
                        </span>
                      </button>
                    </IconTooltip>
                  </div>
                  {watchlistError?.cardId === c.id && (
                    <div
                      role="alert"
                      className="absolute bottom-2 right-2 z-10 max-w-[130px] rounded-lg bg-[#3A3A3E] px-2.5 py-1.5 text-[11px] font-semibold leading-snug text-white shadow-lg"
                    >
                      {watchlistError.message}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {loadState !== "error" && totalPages > 1 && (
          <div className="mt-6 flex flex-col items-center gap-2.5">
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <button
                onClick={() => pageBlock.prevBlockPage != null && goToPage(pageBlock.prevBlockPage)}
                disabled={pageBlock.prevBlockPage == null}
                aria-label="이전 5페이지"
                className={PAGE_NAV_BUTTON_CLASS}
              >
                &laquo;
              </button>
              <button
                onClick={() => goToPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                aria-label="이전 페이지"
                className={PAGE_NAV_BUTTON_CLASS}
              >
                &lsaquo;
              </button>
              {pageBlock.pages.map((p) => (
                <button
                  key={p}
                  onClick={() => goToPage(p)}
                  aria-current={p === page ? "page" : undefined}
                  className={`${PAGE_BUTTON_SIZE_CLASS} ${
                    p === page
                      ? "bg-primary text-white"
                      : "border border-[#DDDDE3] bg-white text-[#4B4B52] hover:border-primary hover:text-primary"
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => goToPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                aria-label="다음 페이지"
                className={PAGE_NAV_BUTTON_CLASS}
              >
                &rsaquo;
              </button>
              <button
                onClick={() => pageBlock.nextBlockPage != null && goToPage(pageBlock.nextBlockPage)}
                disabled={pageBlock.nextBlockPage == null}
                aria-label="다음 5페이지"
                className={PAGE_NAV_BUTTON_CLASS}
              >
                &raquo;
              </button>
            </div>

            {/* 페이지 직접 입력 — form으로 감싸 Enter 키와 "이동" 버튼이 같은 경로를 타게 한다.
                (이 컴포넌트 바깥의 검색창 form과는 형제 관계라 중첩되지 않는다.) */}
            <form onSubmit={submitPageInput} className="flex items-center gap-1.5">
              <label htmlFor="market-page-input" className="sr-only">
                이동할 페이지 번호
              </label>
              <input
                id="market-page-input"
                type="text"
                inputMode="numeric"
                value={pageInput}
                onChange={(e) => {
                  // 숫자가 아닌 문자는 입력 단계에서 걸러내고(붙여넣기 포함), 자릿수도 제한해
                  // 범위 검증 전에 비정상적으로 큰 값이 들어오지 않게 한다.
                  setPageInput(e.target.value.replace(/[^0-9]/g, "").slice(0, 7));
                  setPageInputError("");
                }}
                placeholder={String(page)}
                aria-invalid={pageInputError ? true : undefined}
                aria-describedby={pageInputError ? "market-page-input-error" : undefined}
                className="h-8 w-16 rounded-[9px] border border-[#DDDDE3] bg-white px-2 text-center text-[12px] font-bold text-[#4B4B52] placeholder:font-normal placeholder:text-[#C5C5CC] focus:border-primary focus:outline-none sm:h-9 sm:text-[13px]"
              />
              <button
                type="submit"
                className="h-8 rounded-[9px] border border-[#DDDDE3] bg-white px-3 text-[12px] font-bold text-[#4B4B52] hover:border-primary hover:text-primary sm:h-9 sm:text-[13px]"
              >
                페이지 이동
              </button>
            </form>

            {pageInputError && (
              <p
                id="market-page-input-error"
                role="alert"
                className="text-[12px] font-semibold text-[#D14343]"
              >
                {pageInputError}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
