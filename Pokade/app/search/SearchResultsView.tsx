import { Dispatch, SetStateAction, useEffect, useRef } from "react";
import Link from "next/link";
import { GRADE_DESCRIPTIONS } from "@/components/GradeBadge";
import CardImage from "@/components/CardImage";
import { CardSearchItem } from "@/types/card";
import { CardPriceSummaryResponse } from "@/types/price";
import { CardSort } from "@/lib/cardApi";
import { highlightMatch } from "@/lib/highlightMatch";
import { pickDisplayName } from "@/lib/pickDisplayName";
import { resolvePriceDisplay } from "@/lib/priceDisplay";
import { PRICE_MAX } from "./constants";

type LoadState = "loading" | "error" | "ready";

// size 파라미터를 넘기지 않을 때 BE 기본 페이지 size(cardApi.ts 주석 참고)와 맞춘 스켈레톤 칸 수.
const SEARCH_SKELETON_COUNT = 20;

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
  setOptions: { label: string; expansionId: string }[];
  typeOptions: string[];
  rarityOptions: string[];
  facetsLoading: boolean;
  priceMin: number;
  setPriceMin: Dispatch<SetStateAction<number>>;
  priceMax: number;
  setPriceMax: Dispatch<SetStateAction<number>>;
  setPriceRangeNow: (min: number, max: number) => void;
  activeHandle: "min" | "max" | null;
  setActiveHandle: Dispatch<SetStateAction<"min" | "max" | null>>;
  sort: CardSort;
  setSort: Dispatch<SetStateAction<CardSort>>;
  setLoadState: Dispatch<SetStateAction<LoadState>>;
  loadState: LoadState;
  errorMessage: string;
  cards: CardSearchItem[];
  priceSummaries: Map<number, CardPriceSummaryResponse>;
  totalElements: number;
  totalPages: number;
  page: number;
  goToPage: (p: number) => void;
  resetFilters: () => void;
  setReloadKey: Dispatch<SetStateAction<number>>;
}

const toggleValue = (list: string[], value: string) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

// 페이지네이션 윈도우 — 전체 페이지를 다 그리지 않고 현재 페이지 주변 + 처음/끝만 노출,
// 나머지는 "..."로 생략한다. (siblingCount=1: 현재 페이지 양옆 1개씩)
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

  // 슬라이더(range input)와 직접 입력(number input)이 공유하는 min/max 클램핑 로직 —
  // 두 값이 서로를 앞지르지 않도록(min<=max) 여기서 한 번에 검증한다.
  const handleMinChange = (value: number) => {
    setActiveHandle("min");
    setPriceMin(Math.min(Math.max(value, 0), priceMax));
  };
  const handleMaxChange = (value: number) => {
    setActiveHandle("max");
    setPriceMax(Math.max(Math.min(value, PRICE_MAX), priceMin));
  };

  return (
    <div
      className={`grid items-start gap-6 ${q ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-[250px_1fr]"}`}
    >
      {/* filter sidebar — 키워드 검색 중에는 세트 필터와 동시 적용하지 않으므로 숨김.
          lg 미만에서는 사이드바 대신 "필터" 버튼으로 여는 바텀시트/드로어로 표시. */}
      {!q && (
        <div
          className={
            filterOpen
              ? "fixed inset-0 z-50 flex flex-col justify-end bg-black/40 lg:static lg:z-auto lg:block lg:bg-transparent"
              : "hidden lg:block"
          }
          onClick={filterOpen ? () => setFilterOpen(false) : undefined}
          role={filterOpen ? "dialog" : undefined}
          aria-modal={filterOpen ? true : undefined}
          aria-labelledby={filterOpen ? "filter-drawer-title" : undefined}
        >
          <div
            ref={filterPanelRef}
            tabIndex={-1}
            className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl border border-[#EDEDF0] bg-white p-[22px] outline-none lg:sticky lg:top-[88px] lg:max-h-none lg:w-auto lg:overflow-visible lg:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between lg:relative">
              <span className="flex items-center gap-1.5 text-[15px] font-extrabold">
                <span id="filter-drawer-title">필터</span>
                <span
                  tabIndex={0}
                  className="group relative inline-flex h-3.5 w-3.5 shrink-0 cursor-help items-center justify-center rounded-full bg-black/10 text-[8px] font-bold leading-none text-[#6B6B72] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#6B6B72] lg:static"
                >
                  ?
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute left-0 top-[calc(100%+6px)] z-20 w-max max-w-[calc(100vw-80px)] break-keep rounded-md bg-[#1A1A1E] px-2.5 py-1.5 text-[11px] font-medium leading-relaxed text-white opacity-0 shadow-lift transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100 lg:left-1/2 lg:max-w-[190px] lg:-translate-x-1/2"
                  >
                    <span className="mb-1 block">
                      <b>S</b>: {GRADE_DESCRIPTIONS.S}
                    </span>
                    <span className="mb-1 block">
                      <b>A</b>: {GRADE_DESCRIPTIONS.A}
                    </span>
                    <span className="block">
                      <b>B</b>: {GRADE_DESCRIPTIONS.B}
                    </span>
                  </span>
                </span>
              </span>
              <button
                type="button"
                onClick={() => setFilterOpen(false)}
                aria-label="필터 닫기"
                className="flex h-6 w-6 items-center justify-center rounded-full text-[#9A9AA2] hover:bg-[#F2F2F5] hover:text-ink lg:hidden"
              >
                ×
              </button>
            </div>
            <div className="mb-[9px] text-[12.5px] font-bold text-[#4B4B52]">세트</div>
            <div className="mb-5 flex flex-col gap-[9px]">
              {facetsLoading ? (
                <span className="text-[12.5px] text-[#9A9AA2]">불러오는 중...</span>
              ) : (
                setOptions.map((opt) => (
                  <label
                    key={opt.expansionId}
                    className="flex cursor-pointer items-center gap-2 text-[13px] text-[#5A5A62]"
                  >
                    <input
                      type="radio"
                      name="expansion-filter"
                      checked={selectedExpansionId === opt.expansionId}
                      onClick={() => {
                        if (selectedExpansionId === opt.expansionId) {
                          setLoadState("loading");
                          setSelectedExpansionId(null);
                        }
                      }}
                      onChange={() => {
                        setLoadState("loading");
                        setSelectedExpansionId(opt.expansionId);
                      }}
                    />
                    {opt.label}
                  </label>
                ))
              )}
            </div>
            <div className="mb-[18px] h-px bg-[#F0F0F0]" />
            <div className="mb-[9px] text-[12.5px] font-bold text-[#4B4B52]">타입</div>
            <div className="mb-5 flex flex-col gap-[9px]">
              {facetsLoading ? (
                <span className="text-[12.5px] text-[#9A9AA2]">불러오는 중...</span>
              ) : (
                typeOptions.map((t) => (
                  <label
                    key={t}
                    className="flex cursor-pointer items-center gap-2 text-[13px] text-[#5A5A62]"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes(t)}
                      onChange={() => {
                        setLoadState("loading");
                        setSelectedTypes(toggleValue(selectedTypes, t));
                      }}
                    />
                    {t}
                  </label>
                ))
              )}
            </div>
            <div className="mb-[18px] h-px bg-[#F0F0F0]" />
            <div className="mb-[9px] text-[12.5px] font-bold text-[#4B4B52]">레어도</div>
            <div className="mb-5 flex flex-col gap-[9px]">
              {facetsLoading ? (
                <span className="text-[12.5px] text-[#9A9AA2]">불러오는 중...</span>
              ) : (
                rarityOptions.map((r) => (
                  <label
                    key={r}
                    className="flex cursor-pointer items-center gap-2 text-[13px] text-[#5A5A62]"
                  >
                    <input
                      type="checkbox"
                      checked={selectedRarities.includes(r)}
                      onChange={() => {
                        setLoadState("loading");
                        setSelectedRarities(toggleValue(selectedRarities, r));
                      }}
                    />
                    {r}
                  </label>
                ))
              )}
            </div>
            <div className="mb-[18px] h-px bg-[#F0F0F0]" />
            <div className="mb-3 text-[12.5px] font-bold text-[#4B4B52]">가격대</div>
            <div className="mb-3 flex flex-col gap-2">
              <label
                htmlFor="price-min-input"
                className="flex items-center gap-1.5 rounded-[9px] border border-[#DDDDE3] px-2.5 py-2 focus-within:border-primary"
              >
                <span className="shrink-0 text-[11px] font-semibold text-[#9A9AA2]">최소</span>
                <input
                  id="price-min-input"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={priceMax}
                  step={10}
                  value={priceMin}
                  onChange={(e) => handleMinChange(Number(e.target.value))}
                  className="w-full min-w-0 border-none p-0 text-right text-[12.5px] font-bold text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="shrink-0 text-[11px] text-[#9A9AA2]">원</span>
              </label>
              <label
                htmlFor="price-max-input"
                className="flex items-center gap-1.5 rounded-[9px] border border-[#DDDDE3] px-2.5 py-2 focus-within:border-primary"
              >
                <span className="shrink-0 text-[11px] font-semibold text-[#9A9AA2]">최대</span>
                <input
                  id="price-max-input"
                  type="number"
                  inputMode="numeric"
                  min={priceMin}
                  max={PRICE_MAX}
                  step={10}
                  value={priceMax}
                  onChange={(e) => handleMaxChange(Number(e.target.value))}
                  className="w-full min-w-0 border-none p-0 text-right text-[12.5px] font-bold text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="shrink-0 text-[11px] text-[#9A9AA2]">원</span>
              </label>
            </div>
            <div className="relative h-6">
              <div className="absolute left-0 right-0 top-[11px] h-1 rounded-sm bg-[#E7E7EB]" />
              <div
                className="absolute top-[11px] h-1 rounded-sm bg-primary"
                style={{
                  left: `${(priceMin / PRICE_MAX) * 100}%`,
                  right: `${100 - (priceMax / PRICE_MAX) * 100}%`,
                }}
              />
              <input
                type="range"
                min={0}
                max={PRICE_MAX}
                step={50000}
                value={priceMin}
                onChange={(e) => handleMinChange(+e.target.value)}
                aria-label="최소 가격"
                aria-valuetext={`${priceMin.toLocaleString("ko-KR")}원`}
                className={`dual-range pointer-events-none absolute left-0 top-0 m-0 h-6 w-full appearance-none bg-transparent ${
                  activeHandle === "min" ? "z-20" : "z-10"
                }`}
              />
              <input
                type="range"
                min={0}
                max={PRICE_MAX}
                step={50000}
                value={priceMax}
                onChange={(e) => handleMaxChange(+e.target.value)}
                aria-label="최대 가격"
                aria-valuetext={`${priceMax.toLocaleString("ko-KR")}원`}
                className={`dual-range pointer-events-none absolute left-0 top-0 m-0 h-6 w-full appearance-none bg-transparent ${
                  activeHandle === "min" ? "z-10" : "z-20"
                }`}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-xs text-[#9A9AA2]">
              <span>0원</span>
              <span>{PRICE_MAX.toLocaleString("ko-KR")}원</span>
            </div>
            <button
              onClick={resetFilters}
              className="mt-[22px] w-full rounded-[10px] border-[1.5px] border-[#DDDDE3] bg-white py-2.5 text-[13.5px] font-bold text-[#4B4B52] hover:border-primary hover:text-primary"
            >
              필터 초기화
            </button>
            <button
              type="button"
              onClick={() => setFilterOpen(false)}
              className="mt-2.5 w-full rounded-[10px] bg-primary py-2.5 text-[13.5px] font-bold text-white lg:hidden"
            >
              필터 적용하기
            </button>
          </div>
        </div>
      )}

      {/* results grid */}
      <div>
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {!q && (
              <button
                ref={filterButtonRef}
                type="button"
                onClick={() => setFilterOpen(true)}
                className="flex items-center gap-1 rounded-[9px] border border-[#DDDDE3] bg-white px-3 py-2 text-[13px] font-bold text-[#4B4B52] lg:hidden"
              >
                필터
              </button>
            )}
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
          {/* 키워드 검색(q)은 BE에 sort 파라미터가 없어 정렬 옵션을 숨긴다 */}
          {!q && (
            <select
              value={sort}
              onChange={(e) => {
                setLoadState("loading");
                setSort(e.target.value as CardSort);
              }}
              aria-label="정렬 기준"
              className="cursor-pointer rounded-[9px] border border-[#DDDDE3] bg-white px-3 py-2 text-[13px] outline-none"
            >
              <option value="latest">최신순</option>
              <option value="popular">인기순</option>
              <option value="name">이름순</option>
            </select>
          )}
        </div>

        {!q &&
          (selectedExpansionId ||
            selectedTypes.length > 0 ||
            selectedRarities.length > 0 ||
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
            {cards.map((c) => {
              const priceDisplay = resolvePriceDisplay(priceSummaries.get(c.id));
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
                          <div className="text-[11px] text-[#9A9AA2]">{priceDisplay.label}</div>
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
