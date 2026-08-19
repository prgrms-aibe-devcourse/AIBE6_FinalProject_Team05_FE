import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GRADE_DESCRIPTIONS } from "@/components/GradeBadge";
import CardImage from "@/components/CardImage";
import { CardFacetOption, CardSearchItem } from "@/types/card";
import { CardPriceSummaryResponse } from "@/types/price";
import { highlightMatch } from "@/lib/highlightMatch";
import { pickDisplayName } from "@/lib/pickDisplayName";
import { PriceBasis, resolvePriceDisplay, resolveSortablePrice } from "@/lib/priceDisplay";
import { isPriceSort, PRICE_MAX, UiSort } from "./constants";

type LoadState = "loading" | "error" | "ready";

// size 파라미터를 넘기지 않을 때 BE 기본 페이지 size(cardApi.ts 주석 참고)와 맞춘 스켈레톤 칸 수.
const SEARCH_SKELETON_COUNT = 20;

// 검색 타일 가격 아래 보조텍스트 — resolvePriceDisplay의 label(문장형, "S등급 상품가" 등)과
// 별도로 짧게 줄인 배지 문구. 홈/워치리스트 등 다른 화면은 여전히 기존 label을 그대로 쓰므로
// 그쪽 표시는 이 매핑과 무관하다.
const BASIS_BADGE_LABEL: Record<PriceBasis, string> = {
  sGrade: "S등급",
  recentTrade: "최근 체결가",
  market: "참고시세",
};

// 언어(국가판) 필터 — 실제 존재 값은 EN/JA뿐(#263 확인). 타입 필터처럼 그룹 없는 플랫
// 체크박스 목록이라 facets API 연동 없이 여기서 고정 목록으로 둔다(개수 배지도 없음).
const LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "EN", label: "영문판(EN)" },
  { value: "JA", label: "일본판(JA)" },
];

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

// #142 레어도 중분류 — 배포 사이트(pokade.store)에서 실제 렌더링된 39개 레어도 값을 기준으로
// 확정된 정적 매핑(하드코딩, 임의 변경 금지). 그룹 순서가 곧 화면에 표시되는 그룹 순서다.
const RARITY_GROUPS: { name: string; rarities: string[] }[] = [
  { name: "기본", rarities: ["Common", "Uncommon", "Rare"] },
  {
    name: "홀로",
    rarities: [
      "Rare Holo",
      "Rare Holo EX",
      "Rare Holo GX",
      "Rare Holo Star",
      "Rare Holo V",
      "Rare Holo VMAX",
      "Rare Holo VSTAR",
      "Trainer Gallery Rare Holo",
    ],
  },
  {
    name: "울트라/일러스트",
    rarities: [
      "Ultra Rare",
      "Illustration Rare",
      "Special Illustration Rare",
      "Amazing Rare",
      "Double Rare",
      "Radiant Rare",
    ],
  },
  {
    name: "시크릿/샤이니",
    rarities: [
      "Rare Secret",
      "Rare Rainbow",
      "Rare Shining",
      "Rare Shiny",
      "Rare Shiny GX",
      "Rare Ultra",
      "Shiny Rare",
      "Shiny Ultra Rare",
      "Hyper Rare",
    ],
  },
  {
    name: "레거시 스페셜",
    rarities: [
      "Rare ACE",
      "ACE SPEC Rare",
      "Rare BREAK",
      "Rare Prime",
      "Rare Prism Star",
      "LEGEND",
      "Mega Attack Rare",
      "Mega Hyper Rare",
    ],
  },
  {
    name: "프로모/기타",
    rarities: ["Promo", "Classic Collection", "Black White Rare", "None", "H"],
  },
];

// 매핑표에 없는 신규/미분류 레어도 값을 위한 방어적 폴백 그룹 — API가 매핑표 확정 이후
// 새 레어도를 내려줘도 화면이 죽지 않고 여기로 모인다.
const OTHER_RARITY_GROUP_NAME = "기타";

const RARITY_TO_GROUP = new Map<string, string>();
for (const group of RARITY_GROUPS) {
  for (const rarity of group.rarities) RARITY_TO_GROUP.set(rarity, group.name);
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

  // 직접 입력(number input) 전용 텍스트 상태 — 입력 중에는 클램핑 없이 자유롭게 두고,
  // blur 시점에만 handleMinChange/handleMaxChange로 보정한다. 슬라이더 조작 등으로
  // priceMin/priceMax가 바뀌면(타이핑 중이 아닌 한) 아래에서 표시 텍스트를 동기화한다.
  // (렌더 중 조건부 setState — effect가 아니라 "prop 변경에 맞춰 state 조정하기" 패턴)
  const [minInputText, setMinInputText] = useState(String(priceMin));
  const [prevPriceMin, setPrevPriceMin] = useState(priceMin);
  if (priceMin !== prevPriceMin) {
    setPrevPriceMin(priceMin);
    setMinInputText(String(priceMin));
  }

  const [maxInputText, setMaxInputText] = useState(String(priceMax));
  const [prevPriceMax, setPrevPriceMax] = useState(priceMax);
  if (priceMax !== prevPriceMax) {
    setPrevPriceMax(priceMax);
    setMaxInputText(String(priceMax));
  }

  // 세트는 항상 series 기준 아코디언으로 묶어서 보여준다 — BE가 이미 series 그룹
  // 최신순 → 그룹 내부 이름순으로 정렬해 내려주므로 여기서는 순서를 재정렬하지 않고
  // Map 삽입 순서(=setOptions 순서)만 그대로 유지한다.
  const selectedSetOption = setOptions.find((o) => o.expansionId === selectedExpansionId);
  const seriesGroups = new Map<string, typeof setOptions>();
  for (const opt of setOptions) {
    const group = seriesGroups.get(opt.series);
    if (group) group.push(opt);
    else seriesGroups.set(opt.series, [opt]);
  }

  // 펼쳐진 시리즈 그룹 — 이미 선택된 세트가 있으면 처음부터 그 세트가 속한 그룹을 펼쳐서
  // "세트 필터를 펼쳤는데 내가 고른 세트가 안 보이는" 상황을 피한다. 이후로는 사용자가
  // 자유롭게 접고 펼 수 있다.
  const [expandedSeries, setExpandedSeries] = useState<Set<string>>(
    () => new Set(selectedSetOption ? [selectedSetOption.series] : []),
  );

  const toggleSeries = (series: string) => {
    const next = new Set(expandedSeries);
    if (next.has(series)) next.delete(series);
    else next.add(series);
    setExpandedSeries(next);
  };

  // 아코디언(그룹) 뷰와 검색 중 플랫 뷰가 세트 라디오 한 줄 렌더링을 그대로 공유한다.
  const renderSetOption = (opt: (typeof setOptions)[number]) => (
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
      <span className="text-[#9A9AA2]">({opt.count.toLocaleString("ko-KR")})</span>
    </label>
  );

  // 레어도도 세트의 series 그룹과 동일한 패턴 — API에 실제로 존재하는 값만 그룹 순서
  // (RARITY_GROUPS 정의 순서)대로 채우고, 매핑표에 없는 새 값은 "기타"로 모은다.
  // 그룹/렌더링은 계속 레어도 값(string) 목록으로 다루고, 개수 배지는 이 lookup으로 따로 조회한다.
  const rarityCountByValue = new Map(rarityOptions.map((opt) => [opt.value, opt.count]));
  const rarityOptionSet = new Set(rarityOptions.map((opt) => opt.value));
  const rarityGroups = new Map<string, string[]>();
  for (const group of RARITY_GROUPS) {
    const present = group.rarities.filter((r) => rarityOptionSet.has(r));
    if (present.length > 0) rarityGroups.set(group.name, present);
  }
  const otherRarities = rarityOptions
    .filter((opt) => !RARITY_TO_GROUP.has(opt.value))
    .map((opt) => opt.value);
  if (otherRarities.length > 0) rarityGroups.set(OTHER_RARITY_GROUP_NAME, otherRarities);

  // 펼쳐진 레어도 그룹 — 세트의 expandedSeries와 동일하게, 이미 선택된 레어도가 있으면
  // 처음부터 그 값이 속한 그룹(들)을 펼쳐서 "필터를 펼쳤는데 내가 고른 값이 안 보이는"
  // 상황을 피한다. 레어도는 다중 선택이라 selectedRarities 전부의 그룹을 펼친다.
  const [expandedRarityGroups, setExpandedRarityGroups] = useState<Set<string>>(
    () => new Set(selectedRarities.map((r) => RARITY_TO_GROUP.get(r) ?? OTHER_RARITY_GROUP_NAME)),
  );

  const toggleRarityGroup = (name: string) => {
    const next = new Set(expandedRarityGroups);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setExpandedRarityGroups(next);
  };

  const renderRarityOption = (r: string) => (
    <label key={r} className="flex cursor-pointer items-center gap-2 text-[13px] text-[#5A5A62]">
      <input
        type="checkbox"
        checked={selectedRarities.includes(r)}
        onChange={() => {
          setLoadState("loading");
          setSelectedRarities(toggleValue(selectedRarities, r));
        }}
      />
      {r}
      <span className="text-[#9A9AA2]">({(rarityCountByValue.get(r) ?? 0).toLocaleString("ko-KR")})</span>
    </label>
  );

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
    <div
      className={`grid items-start gap-6 ${q ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-[250px_1fr]"}`}
    >
      {/* filter sidebar — 키워드 검색 중에는 세트 필터와 동시 적용하지 않으므로 숨김.
          lg 미만에서는 사이드바 대신 "필터" 버튼으로 여는 바텀시트/드로어로 표시. */}
      {!q && (
        <div
          className={
            filterOpen
              ? // top-16(헤더 높이)부터만 덮어 헤더 자체(알림/메뉴 트리거 등)는 항상 클릭 가능하게
                // 남겨둔다 — inset-0로 헤더까지 덮으면 필터가 열린 채 헤더 버튼을 눌러도 이 백드롭이
                // 클릭을 가로챈다(Header.tsx의 top-16 백드롭과 동일한 이유).
                "fixed inset-x-0 bottom-0 top-16 z-50 flex flex-col justify-end bg-black/40 lg:static lg:z-auto lg:block lg:bg-transparent"
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
            <div className="mb-5 flex max-h-[260px] flex-col gap-1 overflow-y-auto">
              {facetsLoading ? (
                <span className="text-[12.5px] text-[#9A9AA2]">불러오는 중...</span>
              ) : (
                [...seriesGroups.entries()].map(([series, options], i) => {
                  const isExpanded = expandedSeries.has(series);
                  const panelId = `set-series-panel-${i}`;
                  return (
                    <div key={series}>
                      <button
                        type="button"
                        onClick={() => toggleSeries(series)}
                        aria-expanded={isExpanded}
                        aria-controls={panelId}
                        className="flex w-full items-center justify-between rounded-md px-1 py-1.5 text-[13px] font-semibold text-[#4B4B52] hover:bg-[#F2F2F5]"
                      >
                        <span>{series}</span>
                        <span
                          aria-hidden="true"
                          className={`text-[10px] text-[#9A9AA2] transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        >
                          ▸
                        </span>
                      </button>
                      {isExpanded && (
                        <div id={panelId} className="flex flex-col gap-[9px] py-1 pl-3">
                          {options.map(renderSetOption)}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <div className="mb-[18px] h-px bg-[#F0F0F0]" />
            <div className="mb-[9px] text-[12.5px] font-bold text-[#4B4B52]">타입</div>
            <div className="mb-5 flex flex-col gap-[9px]">
              {facetsLoading ? (
                <span className="text-[12.5px] text-[#9A9AA2]">불러오는 중...</span>
              ) : (
                typeOptions.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex cursor-pointer items-center gap-2 text-[13px] text-[#5A5A62]"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes(opt.value)}
                      onChange={() => {
                        setLoadState("loading");
                        setSelectedTypes(toggleValue(selectedTypes, opt.value));
                      }}
                    />
                    {opt.value}
                    <span className="text-[#9A9AA2]">({opt.count.toLocaleString("ko-KR")})</span>
                  </label>
                ))
              )}
            </div>
            <div className="mb-[18px] h-px bg-[#F0F0F0]" />
            <div className="mb-[9px] text-[12.5px] font-bold text-[#4B4B52]">레어도</div>
            <div className="mb-5 flex max-h-[260px] flex-col gap-1 overflow-y-auto">
              {facetsLoading ? (
                <span className="text-[12.5px] text-[#9A9AA2]">불러오는 중...</span>
              ) : (
                [...rarityGroups.entries()].map(([groupName, rarities], i) => {
                  const isExpanded = expandedRarityGroups.has(groupName);
                  const panelId = `rarity-group-panel-${i}`;
                  return (
                    <div key={groupName}>
                      <button
                        type="button"
                        onClick={() => toggleRarityGroup(groupName)}
                        aria-expanded={isExpanded}
                        aria-controls={panelId}
                        className="flex w-full items-center justify-between rounded-md px-1 py-1.5 text-[13px] font-semibold text-[#4B4B52] hover:bg-[#F2F2F5]"
                      >
                        <span>{groupName}</span>
                        <span
                          aria-hidden="true"
                          className={`text-[10px] text-[#9A9AA2] transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        >
                          ▸
                        </span>
                      </button>
                      {isExpanded && (
                        <div id={panelId} className="flex flex-col gap-[9px] py-1 pl-3">
                          {rarities.map(renderRarityOption)}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <div className="mb-[18px] h-px bg-[#F0F0F0]" />
            <div className="mb-[9px] text-[12.5px] font-bold text-[#4B4B52]">언어</div>
            <div className="mb-5 flex flex-col gap-[9px]">
              {LANGUAGE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-2 text-[13px] text-[#5A5A62]"
                >
                  <input
                    type="checkbox"
                    checked={selectedLanguages.includes(opt.value)}
                    onChange={() => {
                      setLoadState("loading");
                      setSelectedLanguages(toggleValue(selectedLanguages, opt.value));
                    }}
                  />
                  {opt.label}
                </label>
              ))}
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
                  value={minInputText}
                  onChange={(e) => setMinInputText(e.target.value)}
                  onBlur={(e) => handleMinChange(Number(e.target.value))}
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
                  value={maxInputText}
                  onChange={(e) => setMaxInputText(e.target.value)}
                  onBlur={(e) => handleMaxChange(Number(e.target.value))}
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
                const next = e.target.value as UiSort;
                // priceAsc/priceDesc는 BE에 안 보내는 FE 전용 값이라 실제로는 둘 다 기본 정렬
                // (popular)로 조회한 뒤 클라이언트에서 재정렬만 한다 — popular↔priceAsc/priceDesc
                // 간 전환처럼 BE 요청이 실제로 바뀌지 않을 때 setLoadState("loading")을 부르면
                // 재요청이 없어 "ready"로 되돌아오지 못하고 로딩 상태에 그대로 갇힌다.
                const apiSortChanged = (isPriceSort(sort) ? "popular" : sort) !==
                  (isPriceSort(next) ? "popular" : next);
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
          )}
        </div>

        {!q &&
          (selectedExpansionId ||
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
            {displayCards.map((c) => {
              const priceDisplay = resolvePriceDisplay(priceSummaries.get(c.id));
              // "다른 등급도 있음" 힌트 개수 — S등급 상품가가 기준이면 S를 뺀 나머지 활성 매물
              // 등급만 "다른 등급"이고, 최근 체결가/참고시세가 기준이면(=활성 S등급 매물이 없다는
              // 뜻) 활성 매물이 있는 등급 전부가 화면에 보이는 값과는 다른 등급이다.
              const otherGradesCount = priceDisplay
                ? (priceDisplay.basis === "sGrade"
                    ? c.grades.filter((g) => g !== "S")
                    : c.grades
                  ).length
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
