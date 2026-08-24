import { Dispatch, RefObject, SetStateAction, useState } from "react";
import { CardFacetOption } from "@/types/card";
import { LANGUAGE_OPTIONS, PRICE_MAX } from "./constants";

type LoadState = "loading" | "error" | "ready";

const toggleValue = (list: string[], value: string) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

// 가격대 직접 입력 자릿수 제한(#187) — 숫자가 아닌 문자는 입력 즉시 제거하고 PRICE_MAX
// (10,000,000)의 자릿수만큼만 허용한다. blur 시점의 클램핑(handleMinChange 등)과는 별개로,
// 타이핑 중에도 자릿수 자체를 여기서 먼저 제한한다 — 콤마 포함 문자열이 들어와도 숫자 아닌
// 문자를 먼저 걸러내므로 콤마 유무와 무관하게 항상 숫자 개수 기준으로 자른다.
const PRICE_INPUT_MAX_LENGTH = String(PRICE_MAX).length;
const sanitizePriceInput = (raw: string) => raw.replace(/\D/g, "").slice(0, PRICE_INPUT_MAX_LENGTH);

// 가격 필터가 다루는 최소 단위. 1원 단위까지 받으면 실질적으로 같은 조건이 무한히 생기므로
// blur 시점에 이 단위로 반올림한다(handleMinChange/handleMaxChange).
// 이 값보다 잘아서 반올림 결과가 0이 되는 입력(1~49원)은 "필터 해제"가 아니라 잘못된 입력으로
// 보고 직전 값으로 되돌린다 — 해제는 입력창을 비우는 것으로만 한다.
const PRICE_STEP = 100;

// 천단위 콤마 표시(#187 후속) — 자릿수 제한과 별개로, 입력창에는 항상 콤마 포맷으로 보여준다.
const formatPriceDigits = (digits: string) =>
  digits === "" ? "" : Number(digits).toLocaleString("ko-KR");

// 콤마가 추가/제거되면서 커서가 엉뚱한 곳으로 튀는 걸 막기 위한 처리 — 리액트가 상태를 반영해
// 다시 그리기 전에, 이 이벤트 핸들러 안에서 DOM value/커서를 먼저 동기적으로 맞춰버린다(그러면
// 이후 리액트가 같은 문자열로 value를 다시 세팅해도 이미 같은 값이라 커서가 그대로 유지된다).
// 커서 재계산은 "커서 앞에 숫자가 몇 개 있었는지"를 기준으로 한다 — 콤마 위치가 바뀌어도
// 숫자 개수 기준 위치는 변하지 않으므로 이 값만 그대로 포맷된 문자열에 다시 적용하면 된다.
const formatPriceInputChange = (e: React.ChangeEvent<HTMLInputElement>): string => {
  const input = e.target;
  const caret = input.selectionStart ?? input.value.length;
  const digitsBeforeCaret = input.value.slice(0, caret).replace(/\D/g, "").length;
  const digits = sanitizePriceInput(input.value);
  const formatted = formatPriceDigits(digits);

  let seen = 0;
  let newCaret = formatted.length;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) {
      seen++;
      if (seen === digitsBeforeCaret) {
        newCaret = i + 1;
        break;
      }
    }
  }
  if (digitsBeforeCaret === 0) newCaret = 0;

  input.value = formatted;
  input.setSelectionRange(newCaret, newCaret);
  return formatted;
};

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

interface SearchFilterSidebarProps {
  filterOpen: boolean;
  setFilterOpen: Dispatch<SetStateAction<boolean>>;
  filterPanelRef: RefObject<HTMLDivElement | null>;
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
  setLoadState: Dispatch<SetStateAction<LoadState>>;
  resetFilters: () => void;
}

// 필터 체크박스(#238) — 브라우저 기본 체크박스는 OS 기본색(파란색)이라 이 화면에서 유일하게
// 팔레트 밖 색이었다. appearance-none으로 "그리기"만 가져오고 <input type="checkbox"> 요소
// 자체는 그대로 두므로 Tab 이동/Space 토글/label 연결·클릭이 전부 기존과 동일하게 유지된다.
// 체크 표시는 인라인 SVG를 background-image로 얹는다 — input은 대체 요소라 ::after가 렌더되지
// 않아 가상 요소로는 그릴 수 없고, 이 방식은 아이콘 컴포넌트나 파일을 추가하지 않아도 된다.
// 선택 상태는 primary 면 + 흰 체크만으로 알린다 — 그림자를 쓰지 않아 아래 패널/검색창과 같은
// 선 기반 마감을 유지한다. 미선택은 2px #C9C9CF 각진 테두리, radius 2px로 카드 마켓 톤을 따른다.
// appearance-none은 기본 포커스 링까지 지우므로 focus-visible 링을 직접 되살린다.
const FILTER_CHECKBOX_CLASS = [
  "h-4 w-4 flex-shrink-0 cursor-pointer appearance-none rounded-[2px] border-2 border-[#C9C9CF] bg-white",
  "bg-center bg-no-repeat",
  "checked:border-primary-dark checked:bg-primary",
  "checked:bg-[url(data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2010%2010%22%3E%3Cpath%20d=%22M1.6%205.3L3.9%207.4L8.4%202.7%22%20fill=%22none%22%20stroke=%22white%22%20stroke-width=%222%22/%3E%3C/svg%3E)] checked:bg-[length:10px_10px]",
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
].join(" ");

// 아코디언 화살표(#238) — 텍스트 글리프는 폰트/OS에 따라 두께와 세로 정렬이 달라 흐릿하다.
// clip-path 삼각형은 어디서나 픽셀이 딱 떨어지고 rotate-90도 깔끔하게 돈다. 섹션 헤더/세트
// series/레어도 그룹 3곳이 같은 모양을 쓰므로 한 컴포넌트로 묶는다.
function AccordionChevron({ expanded }: { expanded: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`h-2 w-2 flex-shrink-0 bg-[#9A9AA2] transition-transform [clip-path:polygon(0_0,100%_50%,0_100%)] ${
        expanded ? "rotate-90" : ""
      }`}
    />
  );
}

// 필터 섹션 아코디언(#238) — 5개 섹션이 전부 펼쳐진 채 고정이라 사이드바 콘텐츠가 1,400px를
// 넘어(패널 가시 높이의 2배 이상) 레어도/언어/가격대는 존재 자체가 스크롤해야 보였다.
type FilterSectionKey = "set" | "type" | "rarity" | "language" | "price";

// 섹션 헤더 — 세트/레어도 "하위 그룹" 아코디언과 같은 마크업(aria-expanded/aria-controls +
// AccordionChevron 회전)을 그대로 쓰되, 접힌 상태에서도 뭘 골랐는지 알 수 있게 선택 개수
// 배지를 붙인다.
// 가격대처럼 개수 세기가 어색한 섹션은 "적용됨"을 1로 넘긴다 — 결과 영역의 필터 칩도 가격대를
// 칩 하나로 세므로 배지 숫자와 칩 개수가 어긋나지 않는다.
function FilterSectionHeader({
  title,
  panelId,
  expanded,
  selectedCount,
  onToggle,
}: {
  title: string;
  panelId: string;
  expanded: boolean;
  selectedCount: number;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-controls={panelId}
      // 선 기반(#238): 배경으로 감싼 카드형 행 대신 구분선으로만 나뉘는 목록 행으로 바꾼다 —
      // rounded-md/hover 배경을 걷어내고, hover 피드백은 글자색 변화로만 준다.
      className="flex w-full items-center justify-between py-3 text-[12.5px] font-bold text-[#4B4B52] transition-colors hover:text-ink"
    >
      <span className="flex items-baseline gap-1.5">
        {title}
        {/* 선택 개수는 채운 배지 대신 숫자만 둔다 — pill 형태를 줄이면서도 primary 색으로
            "선택됨"은 그대로 읽힌다. 개수 계산 로직(selectedCounts)은 기존 것을 그대로 쓴다. */}
        {selectedCount > 0 && (
          <span className="text-[11.5px] font-extrabold text-primary">{selectedCount}</span>
        )}
      </span>
      <AccordionChevron expanded={expanded} />
    </button>
  );
}

// SearchResultsView의 필터 사이드바/드로어 — 세트(series 그룹)/타입/레어도(그룹)/언어/가격대
// 필터 전부와 그 UI 전용 상태를 담는다(#142, 순수 구조 분리). 필터 "선택값"(selectedTypes 등)은
// 여전히 page.tsx가 소유해 props로만 받고, 세트/레어도 그룹의 펼침 여부(expandedSeries/
// expandedRarityGroups)는 이 컴포넌트 밖에서 참조하는 곳이 없어 로컬 상태로 그대로 뒀다.
export default function SearchFilterSidebar({
  filterOpen,
  setFilterOpen,
  filterPanelRef,
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
  setLoadState,
  resetFilters,
}: SearchFilterSidebarProps) {
  // 직접 입력 전용 보정 — blur 시점에 클램핑하고 PRICE_STEP 단위로 스냅한다.
  // 두 값이 서로를 앞지르지 않도록(min<=max) 여기서 한 번에 검증한다. 확정된 값이 기존
  // priceMin/priceMax와 같으면(예: PRICE_MAX보다 큰 값을 입력) setPriceMin/Max가 상태를 바꾸지
  // 않아 아래 prevPriceMin/Max 비교 기반 동기화가 발동하지 않는다 — 그래서 입력창 텍스트는
  // 여기서 직접 맞춰, 화면에 보정 전 값이 남는 일이 없게 한다.
  const handleMinChange = (value: number) => {
    const clamped = Math.min(Math.max(value, 0), priceMax);
    const snapped = Math.round(clamped / PRICE_STEP) * PRICE_STEP;
    // 값을 넣긴 했는데 눈금에 못 미쳐 0이 된 경우(1~49원)는 입력 자체를 물리고 직전 값을 지킨다.
    // clamped가 0이면 입력창을 비웠거나 0을 직접 넣은 것이라 해제 의도로 보고 그대로 0을 적용한다.
    const next = clamped > 0 && snapped === 0 ? priceMin : snapped;
    setPriceMin(next);
    setMinInputText(next.toLocaleString("ko-KR"));
  };
  const handleMaxChange = (value: number) => {
    const clamped = Math.max(Math.min(value, PRICE_MAX), priceMin);
    const snapped = Math.round(clamped / PRICE_STEP) * PRICE_STEP;
    const next = clamped > 0 && snapped === 0 ? priceMax : snapped;
    setPriceMax(next);
    setMaxInputText(next.toLocaleString("ko-KR"));
  };

  // 직접 입력(콤마 포맷 텍스트 입력) 전용 텍스트 상태 — 입력 중에는 클램핑 없이 자유롭게 두고,
  // blur 시점에만 handleMinChange/handleMaxChange로 보정한다(위 두 함수가 클램핑된 값을
  // 상태와 입력창 텍스트에 함께 반영하므로, 슬라이더 조작이나 blur 입력은 이 비교 블록 없이도
  // 이미 텍스트가 맞다). 이 블록이 실제로 필요한 경우는 그 두 함수를 거치지 않고 priceMin/
  // priceMax를 직접 바꾸는 외부 리셋뿐이다 — 필터 초기화(resetFilters)와 필터 칩 제거
  // (FilterChip onRemove → setPriceRangeNow, page.tsx) — 이때만 아래에서 표시 텍스트를 동기화한다.
  // (렌더 중 조건부 setState — effect가 아니라 "prop 변경에 맞춰 state 조정하기" 패턴)
  const [minInputText, setMinInputText] = useState(priceMin.toLocaleString("ko-KR"));
  const [prevPriceMin, setPrevPriceMin] = useState(priceMin);
  if (priceMin !== prevPriceMin) {
    setPrevPriceMin(priceMin);
    setMinInputText(priceMin.toLocaleString("ko-KR"));
  }

  const [maxInputText, setMaxInputText] = useState(priceMax.toLocaleString("ko-KR"));
  const [prevPriceMax, setPrevPriceMax] = useState(priceMax);
  if (priceMax !== prevPriceMax) {
    setPrevPriceMax(priceMax);
    setMaxInputText(priceMax.toLocaleString("ko-KR"));
  }

  // 섹션별 선택 개수 — 헤더 배지, 초기 펼침 판단, 상단 "N개 선택" 요약이 모두 같은 값을 써야
  // 어긋나지 않으므로 한 곳에서만 센다(이전에는 세 군데에 같은 식이 흩어져 있었다).
  const selectedCounts = {
    set: selectedExpansionId ? 1 : 0,
    type: selectedTypes.length,
    rarity: selectedRarities.length,
    language: selectedLanguages.length,
    price: priceMin > 0 || priceMax < PRICE_MAX ? 1 : 0,
  };
  const totalSelected = Object.values(selectedCounts).reduce((sum, n) => sum + n, 0);

  // 초기 펼침: 이미 선택값이 있는 섹션은 자동으로 펼쳐 "필터를 열었는데 내가 고른 값이 안 보이는"
  // 상황을 피한다(아래 expandedSeries/expandedRarityGroups가 하위 그룹에 쓰는 규칙과 동일).
  // 새로고침/뒤로가기로 URL의 필터가 복원된 경우에도 page.tsx가 첫 렌더에 이미 그 값을 props로
  // 넘겨주므로 여기서 그대로 반영된다. 아무것도 선택돼 있지 않으면 가장 자주 쓰는 타입만 펼친다.
  const [expandedSections, setExpandedSections] = useState<Set<FilterSectionKey>>(() => {
    const initial = new Set<FilterSectionKey>();
    for (const [key, count] of Object.entries(selectedCounts)) {
      if (count > 0) initial.add(key as FilterSectionKey);
    }
    if (initial.size === 0) initial.add("type");
    return initial;
  });

  const toggleSection = (key: FilterSectionKey) => {
    const next = new Set(expandedSections);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedSections(next);
  };

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
      <span className="text-[#9A9AA2]">({(opt.count ?? 0).toLocaleString("ko-KR")})</span>
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
        className={FILTER_CHECKBOX_CLASS}
        checked={selectedRarities.includes(r)}
        onChange={() => {
          setLoadState("loading");
          setSelectedRarities(toggleValue(selectedRarities, r));
        }}
      />
      {r}
      <span className="text-[#9A9AA2]">
        ({(rarityCountByValue.get(r) ?? 0).toLocaleString("ko-KR")})
      </span>
    </label>
  );

  return (
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
        // 스타일 경계(#238): 이 패널 껍데기는 결과 카드와 같은 페이지 레벨 카드 언어(rounded-2xl
        // + shadow-card)를 유지하고, 안의 섹션/체크박스/칩만 선 기반으로 재설계했다 — 의도된
        // 이중 언어이지 정리가 덜 된 게 아니다.
        // lg의 max-h/overflow-y-auto(#235): sticky top-[88px]로 붙여둬도 필터 자체가 뷰포트보다
        // 길면(아코디언을 펼치면 쉽게 그렇게 된다) 아래쪽이 화면 밖으로 나가 sticky가 무의미해진다.
        // 헤더(88px) + 아래 여백(16px)을 뺀 높이로 잘라 필터가 자체 스크롤되게 한다.
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl border border-[#EDEDF0] bg-white p-[22px] outline-none lg:sticky lg:top-[88px] lg:max-h-[calc(100vh-104px)] lg:w-auto lg:overflow-y-auto lg:rounded-2xl lg:shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 행(#238) — "필터 / 초기화"를 한 줄에 놓고, 아래 섹션 목록과 같은 구분선으로
            끊는다. 초기화가 맨 아래에 있으면 섹션을 다 지나쳐야 보여 발견이 늦었다.
            "N개 선택"은 섹션을 접어둔 상태에서도 지금 몇 개가 걸려 있는지 알려준다. */}
        <div className="flex items-center justify-between border-b border-[#F0F0F0] pb-3">
          <span className="flex items-baseline gap-2 text-[15px] font-extrabold">
            <span id="filter-drawer-title">필터</span>
            {totalSelected > 0 && (
              <span className="text-[12px] font-bold text-[#9A9AA2]">{totalSelected}개 선택</span>
            )}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={resetFilters}
              disabled={totalSelected === 0}
              className="px-1 py-1 text-[12.5px] font-bold text-[#9A9AA2] transition-colors enabled:hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              초기화
            </button>
            <button
              type="button"
              onClick={() => setFilterOpen(false)}
              aria-label="필터 닫기"
              className="flex h-6 w-6 items-center justify-center rounded-[6px] text-[#9A9AA2] hover:bg-[#F2F2F5] hover:text-ink lg:hidden"
            >
              ×
            </button>
          </div>
        </div>
        <FilterSectionHeader
          title="세트"
          panelId="filter-section-set"
          expanded={expandedSections.has("set")}
          selectedCount={selectedCounts.set}
          onToggle={() => toggleSection("set")}
        />
        {expandedSections.has("set") && (
          <div
            id="filter-section-set"
            className="flex max-h-[260px] flex-col gap-1 overflow-y-auto pb-4"
          >
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
                      <AccordionChevron expanded={isExpanded} />
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
        )}
        <div className="h-px bg-[#F0F0F0]" />
        <FilterSectionHeader
          title="타입"
          panelId="filter-section-type"
          expanded={expandedSections.has("type")}
          selectedCount={selectedCounts.type}
          onToggle={() => toggleSection("type")}
        />
        {expandedSections.has("type") && (
          <div id="filter-section-type" className="flex flex-col gap-[9px] pb-4">
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
                    className={FILTER_CHECKBOX_CLASS}
                    checked={selectedTypes.includes(opt.value)}
                    onChange={() => {
                      setLoadState("loading");
                      setSelectedTypes(toggleValue(selectedTypes, opt.value));
                    }}
                  />
                  {opt.value}
                  <span className="text-[#9A9AA2]">
                    ({(opt.count ?? 0).toLocaleString("ko-KR")})
                  </span>
                </label>
              ))
            )}
          </div>
        )}
        <div className="h-px bg-[#F0F0F0]" />
        <FilterSectionHeader
          title="레어도"
          panelId="filter-section-rarity"
          expanded={expandedSections.has("rarity")}
          selectedCount={selectedCounts.rarity}
          onToggle={() => toggleSection("rarity")}
        />
        {expandedSections.has("rarity") && (
          <div id="filter-section-rarity" className="flex flex-col gap-1 pb-4">
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
                      <AccordionChevron expanded={isExpanded} />
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
        )}
        <div className="h-px bg-[#F0F0F0]" />
        <FilterSectionHeader
          title="언어"
          panelId="filter-section-language"
          expanded={expandedSections.has("language")}
          selectedCount={selectedCounts.language}
          onToggle={() => toggleSection("language")}
        />
        {expandedSections.has("language") && (
          <div id="filter-section-language" className="flex flex-col gap-[9px] pb-4">
            {LANGUAGE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex cursor-pointer items-center gap-2 text-[13px] text-[#5A5A62]"
              >
                <input
                  type="checkbox"
                  className={FILTER_CHECKBOX_CLASS}
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
        )}
        <div className="h-px bg-[#F0F0F0]" />
        <FilterSectionHeader
          title="가격대"
          panelId="filter-section-price"
          expanded={expandedSections.has("price")}
          selectedCount={selectedCounts.price}
          onToggle={() => toggleSection("price")}
        />
        {expandedSections.has("price") && (
          <div id="filter-section-price" className="flex flex-col gap-2 pb-4">
            <label
              htmlFor="price-min-input"
              className="flex items-center gap-1.5 rounded-[9px] border border-[#DDDDE3] px-2.5 py-2 focus-within:border-primary"
            >
              <span className="shrink-0 text-[11px] font-semibold text-[#9A9AA2]">최소</span>
              <input
                id="price-min-input"
                type="text"
                inputMode="numeric"
                value={minInputText}
                onChange={(e) => {
                  const text = formatPriceInputChange(e);
                  setMinInputText(text);
                  // 눈금에 못 미치는 값(1~49원)은 필터에 반영하지 않는다 — 반영해 버리면 blur 시점의
                  // "직전 값"이 이미 그 값으로 덮여 있어 handleMinChange가 되돌릴 대상을 잃는다.
                  const digits = sanitizePriceInput(text);
                  if (digits && Math.round(Number(digits) / PRICE_STEP) > 0) {
                    setPriceMin(Number(digits));
                  }
                }}
                onBlur={(e) => handleMinChange(Number(sanitizePriceInput(e.target.value) || "0"))}
                className="w-full min-w-0 border-none p-0 text-right text-[12.5px] font-bold text-ink outline-none"
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
                type="text"
                inputMode="numeric"
                value={maxInputText}
                onChange={(e) => {
                  const text = formatPriceInputChange(e);
                  setMaxInputText(text);
                  // 최소 입력창과 같은 이유 — 되돌릴 직전 값을 지키기 위해 눈금 미달은 반영하지 않는다.
                  const digits = sanitizePriceInput(text);
                  if (digits && Math.round(Number(digits) / PRICE_STEP) > 0) {
                    setPriceMax(Number(digits));
                  }
                }}
                onBlur={(e) => handleMaxChange(Number(sanitizePriceInput(e.target.value) || "0"))}
                className="w-full min-w-0 border-none p-0 text-right text-[12.5px] font-bold text-ink outline-none"
              />
              <span className="shrink-0 text-[11px] text-[#9A9AA2]">원</span>
            </label>
          </div>
        )}
        <button
          type="button"
          onClick={() => setFilterOpen(false)}
          className="mt-5 w-full rounded-[10px] bg-primary py-2.5 text-[13.5px] font-bold text-white lg:hidden"
        >
          필터 적용하기
        </button>
      </div>
    </div>
  );
}
