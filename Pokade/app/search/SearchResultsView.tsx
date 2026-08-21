import { Dispatch, SetStateAction, useEffect, useRef } from "react";
import Link from "next/link";
import CardImage from "@/components/CardImage";
import { SearchBar } from "@/components/CardSearchBar";
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

// 검색 타일 가격 아래 보조텍스트 — resolvePriceDisplay의 label(문장형, "S등급 상품가" 등)과
// 별도로 짧게 줄인 배지 문구. 홈/워치리스트 등 다른 화면은 여전히 기존 label을 그대로 쓰므로
// 그쪽 표시는 이 매핑과 무관하다.
const BASIS_BADGE_LABEL: Record<PriceBasis, string> = {
  sGrade: "S등급",
  recentTrade: "최근 체결가",
  market: "참고시세",
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
}

// 페이지네이션 윈도우 — 전체 페이지를 다 그리지 않고 현재 페이지 주변 + 처음/끝만 노출,
// 나머지는 "..."로 생략한다. (siblingCount=1: 현재 페이지 양옆 1개씩)
// 이 화면(카탈로그 탐색)만 번호+생략 방식을 쓴다 — MyTradesSection.tsx/notifications 전체보기처럼
// 시간순으로 훑어보는 개인 활동 피드는 임의 페이지 점프가 필요 없어 components/Pagination.tsx의
// 단순 prev/next를 쓴다. 페이지 수보다 "탐색 vs 피드"라는 화면 성격 차이가 기준이라 이 둘을
// 하나의 컴포넌트로 통합하지 않는다.
type PaginationItem = number | "ellipsis";

function getPaginationRange(current: number, total: number): PaginationItem[] {
  const siblingCount = 1;
  const totalVisible = siblingCount * 2 + 5; // 처음 + 끝 + 현재 + 양옆 + 생략기호 2개 여유

  if (totalVisible >= total) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const leftSibling = Math.max(current - siblingCount, 1);
  const rightSibling = Math.min(current + siblingCount, total);
  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < total - 1;

  if (!showLeftEllipsis && showRightEllipsis) {
    const leftItemCount = 3 + siblingCount * 2;
    const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);
    return [...leftRange, "ellipsis", total];
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    const rightItemCount = 3 + siblingCount * 2;
    const rightRange = Array.from(
      { length: rightItemCount },
      (_, i) => total - rightItemCount + i + 1,
    );
    return [1, "ellipsis", ...rightRange];
  }

  const middleRange = Array.from(
    { length: rightSibling - leftSibling + 1 },
    (_, i) => leftSibling + i,
  );
  return [1, "ellipsis", ...middleRange, "ellipsis", total];
}

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
}: SearchResultsViewProps) {
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const prevFilterOpenRef = useRef(filterOpen);

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

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[250px_1fr]">
      {/* filter sidebar — #308: 키워드(q) 검색 중에도 필터를 함께 적용할 수 있어 항상 노출한다.
          lg 미만에서는 사이드바 대신 "필터" 버튼으로 여는 바텀시트/드로어로 표시.
          세트/타입/레어도/언어/가격대 필터 전체는 SearchFilterSidebar로 분리돼 있다(#142). */}
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

      {/* results grid */}
      <div>
        <div className="mb-4">
          <SearchBar width="w-full" />
        </div>

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
            <span className="text-[13.5px] text-[#8A8A92]">
              <b className="text-ink">
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
                className="flex flex-col overflow-hidden rounded-[13px] border border-[#EDEDF0]"
              >
                <div className="aspect-[5/7] w-full animate-pulse bg-[#F2F2F5]" />
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <div className="h-[13.5px] w-3/4 animate-pulse rounded bg-[#F2F2F5]" />
                  <div className="h-[11.5px] w-1/2 animate-pulse rounded bg-[#F2F2F5]" />
                  <div className="mt-auto h-[15px] w-2/3 animate-pulse rounded bg-[#F2F2F5]" />
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

        {loadState === "ready" && cards.length === 0 && q && (
          <div className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-[#EDEDF0] bg-white py-24">
            <span className="text-[13.5px] font-semibold text-[#8A8A92]">
              {`"${q}"에 대한 검색 결과가 없습니다.`}
            </span>
            <span className="text-[12.5px] text-[#9A9AA2]">다른 검색어로 시도해보세요.</span>
          </div>
        )}

        {loadState === "ready" && cards.length === 0 && !q && (
          <div className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-[#EDEDF0] bg-white py-24">
            <span className="text-[13.5px] font-semibold text-[#8A8A92]">
              조건에 맞는 카드가 없습니다.
            </span>
            <span className="text-[12.5px] text-[#9A9AA2]">필터를 조정해보세요.</span>
            <button
              onClick={resetFilters}
              className="mt-1.5 rounded-[9px] border-[1.5px] border-[#DDDDE3] bg-white px-4 py-2 text-[13px] font-bold text-[#4B4B52] hover:border-primary hover:text-primary"
            >
              필터 초기화
            </button>
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
                <Link
                  key={c.id}
                  href={`/cards/${c.id}`}
                  className="flex cursor-pointer flex-col overflow-hidden rounded-[13px] border border-[#EDEDF0] transition hover:-translate-y-[3px] hover:shadow-lift"
                >
                  <div className="relative aspect-[5/7] w-full bg-[#F2F2F5]">
                    <CardImage src={c.imageUrl} alt={displayName} label="카드" />
                  </div>
                  <div className="flex flex-1 flex-col p-3">
                    <div className="text-[13.5px] font-bold">
                      {q ? highlightMatch(displayName, q) : displayName}
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-[#9A9AA2]">{c.set}</div>
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
                    <div className="mt-auto pt-2.5">
                      {priceDisplay ? (
                        <>
                          <div className="text-[11px] text-[#9A9AA2]">
                            {BASIS_BADGE_LABEL[priceDisplay.basis]}
                            {otherGradesCount > 0 && ` · 외 ${otherGradesCount}개 등급`}
                          </div>
                          <div className="text-[15px] font-extrabold text-ink">
                            {priceDisplay.price}
                          </div>
                        </>
                      ) : (
                        <div className="text-[15px] font-extrabold text-ink">
                          <span className="text-[13px] font-semibold text-[#9A9AA2]">
                            가격 정보 없음
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {loadState !== "error" && totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-1.5">
            <button
              onClick={() => goToPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              aria-label="이전 페이지"
              className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-[#DDDDE3] bg-white text-[13px] font-bold text-[#4B4B52] enabled:hover:border-primary enabled:hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              &lt;
            </button>
            {getPaginationRange(page, totalPages).map((p, i) =>
              p === "ellipsis" ? (
                <span
                  key={`ellipsis-${i}`}
                  className="flex h-9 w-9 items-center justify-center text-[13px] text-[#9A9AA2]"
                >
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => goToPage(p)}
                  aria-current={p === page ? "page" : undefined}
                  className={`h-9 w-9 rounded-[9px] text-[13px] font-bold ${
                    p === page
                      ? "bg-primary text-white"
                      : "border border-[#DDDDE3] bg-white text-[#4B4B52] hover:border-primary hover:text-primary"
                  }`}
                >
                  {p}
                </button>
              ),
            )}
            <button
              onClick={() => goToPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              aria-label="다음 페이지"
              className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-[#DDDDE3] bg-white text-[13px] font-bold text-[#4B4B52] enabled:hover:border-primary enabled:hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              &gt;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
