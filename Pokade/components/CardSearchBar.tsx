"use client";

import { Suspense, useEffect, useId, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import CardImage from "@/components/CardImage";
import { fetchCardsByKeywordPage } from "@/lib/cardApi";
import { highlightMatch } from "@/lib/highlightMatch";
import { pickDisplayName } from "@/lib/pickDisplayName";
import { useRecentSearchesStore } from "@/store/useRecentSearchesStore";
import { CardResponse, formatSetAndRarity } from "@/types/card";

// 자동완성 API 호출 최소 글자 수 — 1글자는 노이즈가 많아 2글자부터 호출한다.
const MIN_QUERY_LENGTH = 2;

type SearchBarVariant = "default" | "market";

// variant="market": 마켓 페이지(/search) 상단 "카드 검색" 카드(흰 배경) 안에 놓인다. 그림자
// 없이 1px 선 하나로 경계를 잡아, 흰 카드 안에 또 하나의 카드가 겹쳐 보이는 이중 박싱을 피한다.
// 색 강조는 오른쪽 제출 버튼 하나만 맡는다.
// 주의: 이 화면의 제출 버튼은 프로젝트의 다른 primary CTA와 달리 shadow-tactile을 쓰지 않는다
// — #238에서 검색/필터를 선 기반으로 재설계하면서 이 페이지만 먼저 옮겼다. 전체 통일은 미결.
// 테두리 두께를 variant가 직접 소유한다 — 공통 클래스에 `border`(1px)를 두면 variant가 다른
// 두께를 쓸 때 한 요소에서 겹치는데, Tailwind는 클래스 문자열 순서가 아니라 스타일시트 순서로
// 우선순위가 정해져 어느 쪽이 적용될지 보장할 수 없다. 여기서만 지정한다.
const CONTAINER_STYLES: Record<SearchBarVariant, string> = {
  // default(헤더): 연한 테두리 + 은은한 그림자로 입체감을 준다. 배경(bg-neutral)은 포커스에서도
  // 바꾸지 않는다 — 헤더가 흰색이라 이 회색 면이 "입력할 수 있는 곳"임을 알리는 유일한 신호이고,
  // 흰색으로 열면 필드가 헤더에 묻힌다(market은 흰 카드 안이라 반대로 흰색으로 연다).
  // 확장 애니메이션은 넣지 않는다(검색은 상시 노출 유지).
  default:
    "rounded-[11px] border border-[#EDEDF0] bg-neutral px-3.5 py-2.5 shadow-[0_1px_4px_rgba(20,26,52,0.04)]",
  // 스타일 경계: 이 폼을 감싸는 페이지 카드(app/search/page.tsx)는 rounded-2xl + shadow-card인
  // 반면, 그 안의 이 컨트롤은 1px 선 + 그림자 없음이다 — 필터 사이드바와 같은 선 기반 언어로
  // 맞춘, 의도된 이중 언어다. radius 10px은 pill 인상을 피하려고 낮춘 값이다.
  // 배경은 흰색 대신 중립 회색(neutral = #F7F7F8)을 깐다 — 경계는 선이 잡고, 회색 면은 "여기가
  // 입력 영역"임을 색으로 한 번 더 알린다. 헤더(default)와 같은 토큰이라 두 검색창의 바탕이 맞는다.
  market: "rounded-[10px] border border-[#DDDDE3] bg-neutral p-2",
};
const FOCUS_STYLES: Record<SearchBarVariant, string> = {
  // 색(primary)을 쓰지 않고 그림자가 퍼지며 테두리만 진해진다. 헤더는 폭이 224~240px로 좁아
  // 그림자를 한 단계 작게 잡는다.
  default:
    "transition-[box-shadow,border-color] duration-200 focus-within:border-[#9A9AA2] focus-within:shadow-[0_4px_14px_rgba(20,26,52,0.10)]",
  // 포커스하면 회색 바탕이 흰색으로 열리고 테두리가 크게 진해진다. 색(primary)이 아니라 명도
  // 변화로만 알리므로 상단 강조선(빨강)과 겹치지 않고, 색각 이상 사용자에게도 그대로 전달된다.
  market:
    "transition-[border-color,background-color] duration-200 focus-within:border-[#4B4B52] focus-within:bg-white",
};

// 로딩 자리표시(SearchBarShell)와 실제 폼이 같은 값을 써야 전환 시 높이가 튀지 않으므로
// 상수로 묶어 두 곳이 공유한다.
const INPUT_STYLES: Record<SearchBarVariant, string> = {
  default: "text-[13.5px]",
  market: "text-[15px]",
};

// placeholder는 variant별로 나눈다 — 마켓은 "무엇으로 검색되는지"를 알려줄 공간이 있지만,
// 헤더(default)는 224~240px라 긴 문구가 잘린다. 문구에 "카드 번호"를 넣지 않은 건 BE 검색이
// c.name 부분일치/유사도와 도감번호(한글·초성 입력)만 매칭하고 카드 번호·externalId는
// 매칭하지 않기 때문이다(CardSearchSql 확인 + API 실측: 정확한 externalId 검색 0건).
const PLACEHOLDER_TEXT: Record<SearchBarVariant, string> = {
  default: "카드 이름으로 검색",
  market: "카드 이름을 한글 또는 영문으로 검색하세요",
};

// 마켓 전용 제출 버튼. 베이스(모양)와 인터랙션(hover/active)을 분리한다: 로딩 자리표시인
// SearchBarShell의 <span>은 클릭할 수 없어 hover/active가 무의미하므로 베이스만 쓰고, 실제
// <button>만 인터랙션까지 붙인다.
// radius는 폼(10px)보다 한 단계 낮춰 8px — 같은 값이면 안에 든 요소가 껍데기와 같은 층으로
// 읽힌다. 44px 터치 타겟(h-11)은 border-box라 border-b-[3px]를 넣어도 총 높이가 44px로 유지된다.
// 밋밋함은 두 가지로 푼다: ① 타이포(15px/extrabold/자간 -0.2px)로 무게를 올리고, ② 하단 3px
// primary-dark 선으로 두께감을 준다. 그라데이션·그림자는 쓰지 않는다 — 이 화면을 선 기반으로
// 정리한 마감과 같은 언어이고, 색도 primary/primary-dark 둘로만 끝난다.
const MARKET_SUBMIT_BASE =
  "flex h-11 flex-shrink-0 items-center justify-center whitespace-nowrap rounded-[8px] border-b-[3px] border-primary-dark bg-primary px-7 text-[15px] font-extrabold tracking-[-0.2px] text-white";
// 물리 버튼 모델: hover에서 1px 더 떠오르고, active에서 2px 내려앉으며 하단 선이 3px → 1px로
// 줄어 "눌렸다"가 보인다. hover에 배경색 변화를 넣지 않은 이유는 bg가 primary-dark가 되면
// 하단 선과 같은 색이 되어 방금 만든 두께감이 사라지기 때문 — 대신 눌린 순간(active)에만
// primary-dark로 어두워지게 해 색과 깊이가 같은 방향으로 움직이게 했다.
// [@media(hover:hover)] 가드: tailwind.config.ts에 future.hoverOnlyWhenSupported가 꺼져 있어
// 기본 hover:가 터치 기기에서도 걸린다(탭 후 hover가 눌어붙음). 전역 플래그를 켜면 프로젝트
// 39개 파일의 hover가 함께 바뀌므로, 이 버튼에만 미디어쿼리로 막아 모바일에서는 active만 남긴다.
const MARKET_SUBMIT_INTERACTION = [
  "transition-[transform,border-bottom-width,background-color] duration-150",
  "[@media(hover:hover)]:hover:-translate-y-[1px]",
  "active:translate-y-[2px] active:border-b-[1px] active:bg-primary-dark",
].join(" ");
const MARKET_SUBMIT_BUTTON = `${MARKET_SUBMIT_BASE} ${MARKET_SUBMIT_INTERACTION}`;

function SearchIcon({ stroke, size = 18 }: { stroke: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4-4" />
    </svg>
  );
}

export function SearchBar({
  width = "w-60",
  variant = "default",
}: {
  width?: string;
  variant?: SearchBarVariant;
}) {
  // useSearchParams는 Suspense 경계가 필요 — Header는 모든 페이지에 걸쳐있으므로
  // 이 부분만 분리해 나머지 정적 페이지의 prerender를 막지 않는다.
  return (
    <Suspense fallback={<SearchBarShell width={width} variant={variant} />}>
      <SearchBarInner width={width} variant={variant} />
    </Suspense>
  );
}

function SearchBarShell({
  width = "w-60",
  variant = "default",
}: {
  width?: string;
  variant?: SearchBarVariant;
}) {
  return (
    <div className={`flex items-center gap-2 ${CONTAINER_STYLES[variant]} ${width}`}>
      {variant === "default" && <SearchIcon stroke="#9A9AA2" />}
      {variant === "market" && (
        <span className="flex flex-shrink-0 items-center pl-1.5" aria-hidden="true">
          <SearchIcon stroke="#9A9AA2" />
        </span>
      )}
      <input
        placeholder={PLACEHOLDER_TEXT[variant]}
        disabled
        className={`w-full border-none bg-transparent text-ink outline-none ${INPUT_STYLES[variant]}`}
      />
      {/* 실제 폼(SearchBarInner)과 높이가 같아야 로딩→실제 전환 시 튀지 않는다. */}
      {variant === "market" && <span className={MARKET_SUBMIT_BASE}>검색</span>}
    </div>
  );
}

function SearchBarInner({
  width = "w-60",
  variant = "default",
}: {
  width?: string;
  variant?: SearchBarVariant;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // /search?q=… 상태일 때만 그 검색어를 표시용 초기값으로 사용, 그 외 경로는 빈 값.
  const displayQuery = pathname === "/search" ? (searchParams.get("q") ?? "") : "";

  const [query, setQuery] = useState(displayQuery);
  // 페이지 진입(경로/쿼리 변경) 시점에만 동기화 — 타이핑 중엔 건드리지 않는다.
  const [syncedQuery, setSyncedQuery] = useState(displayQuery);
  if (displayQuery !== syncedQuery) {
    setSyncedQuery(displayQuery);
    setQuery(displayQuery);
  }

  // 자동완성 미리보기 — 입력 300ms 후 GET /api/cards/search?q= 호출, 최대 8건 표시.
  const [suggestions, setSuggestions] = useState<CardResponse[]>([]);
  // 전체 검색 결과 건수 — 8건보다 많으면 드롭다운 하단에 "전체 결과 보기" 링크를 노출한다.
  const [totalElements, setTotalElements] = useState(0);
  // 현재 query에 대한 응답 도착 여부 — "로딩 중"과 "응답 완료(0건)"을 구분하기 위함.
  const [searchStatus, setSearchStatus] = useState<"idle" | "loading" | "done">("idle");
  const [focused, setFocused] = useState(false);
  // ESC로 닫은 상태 — focused는 유지하되 드롭다운만 숨긴다. 타이핑하면 다시 열릴 수 있게 초기화.
  const [dismissed, setDismissed] = useState(false);
  // 키보드로 하이라이트된 항목 인덱스. -1이면 하이라이트 없음(Enter 시 기존 submit 유지).
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  // 최근 검색어 — 헤더/마켓의 모든 SearchBar 인스턴스가 store를 공유해서, 한쪽에서 검색/삭제하면
  // 새로고침 없이 다른 인스턴스에도 즉시 반영된다(useRecentSearchesStore 참고).
  const recentSearches = useRecentSearchesStore((s) => s.terms);
  const addRecentSearchTerm = useRecentSearchesStore((s) => s.add);
  const removeRecentSearchTerm = useRecentSearchesStore((s) => s.remove);
  const clearRecentSearchesAll = useRecentSearchesStore((s) => s.clear);

  // 하이라이트가 방향키로 이동할 때 드롭다운 밖으로 벗어나면 보이는 위치까지 스크롤.
  useEffect(() => {
    if (highlightedIndex < 0) return;
    itemRefs.current[highlightedIndex]?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      fetchCardsByKeywordPage(trimmed)
        .then((page) => {
          if (!cancelled) {
            setSuggestions(page.content.slice(0, 8));
            setTotalElements(page.totalElements);
            setSearchStatus("done");
          }
        })
        .catch(() => {
          if (!cancelled) {
            setSuggestions([]);
            setTotalElements(0);
            setSearchStatus("done");
          }
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  // 새 검색어 입력이나 새 결과 도착 시 이전 하이라이트/닫힘 상태를 초기화한다.
  // (위 syncedQuery와 동일하게 렌더 중 비교 패턴 사용 — effect 내 setState 지양)
  const [prevQuery, setPrevQuery] = useState(query);
  const [prevSuggestions, setPrevSuggestions] = useState(suggestions);
  if (query !== prevQuery) {
    const trimmed = query.trim();
    // 검색어가 바뀌면 이전 응답 상태를 즉시 무효화 — 새 응답이 올 때까지 loading/idle로 되돌린다.
    // 최소 글자 수 미만이면 API를 호출하지 않으므로 이전 결과를 즉시 비운다.
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setSearchStatus("idle");
      setSuggestions([]);
      setTotalElements(0);
    } else {
      setSearchStatus("loading");
    }
  }
  if (query !== prevQuery || suggestions !== prevSuggestions) {
    setPrevQuery(query);
    setPrevSuggestions(suggestions);
    setHighlightedIndex(-1);
    setDismissed(false);
  }

  // 검색어(q)만 뺀 /search 주소 — 필터(types/rarity/languages/minPrice…)는 그대로 남긴다.
  // 검색어를 지웠다고 걸어둔 필터까지 풀리면 조건이 조용히 사라져 더 혼란스럽다.
  // /search 밖(헤더)에서는 보존할 필터 자체가 없으므로 목록 첫 화면으로 보낸다.
  // page는 함께 지운다 — 검색 결과 5페이지에서 검색어를 비우면 대상이 전체 목록으로 바뀌는데,
  // 그 목록의 5페이지에 남을 이유가 없고 결과 수가 적으면 빈 페이지에 떨어진다.
  const searchUrlWithoutQuery = () => {
    if (pathname !== "/search") return "/search";
    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    params.delete("page");
    const qs = params.toString();
    return qs ? `/search?${qs}` : "/search";
  };

  // 검색 실행(직접 입력 Enter, 최근 검색어 클릭) 공통 경로 — 검색어를 최근 검색어에 저장한 뒤 이동.
  const runSearch = (term: string) => {
    const trimmed = term.trim();
    inputRef.current?.blur();
    // 빈 검색어는 BE가 400을 반환하므로 q를 붙이지 않는다 — 다만 예전처럼 early return으로
    // 아무 일도 안 하면, 검색어를 지우고 검색한 사용자가 옛 ?q= 가 남은 0건 화면에 갇힌다
    // (탈출구가 헤더 "마켓" 링크뿐이었다, #238). 전체 목록으로 되돌려 보낸다.
    if (!trimmed) {
      router.push(searchUrlWithoutQuery());
      return;
    }
    addRecentSearchTerm(trimmed);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const submit = () => runSearch(query);

  const selectSuggestion = (card: CardResponse) => {
    inputRef.current?.blur();
    setQuery("");
    setSuggestions([]);
    addRecentSearchTerm(card.nameKo ?? card.name);
    router.push(`/cards/${card.id}`);
  };

  const handleClearRecent = () => {
    clearRecentSearchesAll();
  };

  const handleRemoveRecent = (term: string) => {
    removeRecentSearchTerm(term);
  };

  // 입력값 지우기 — "다시 시작할래" 의미이므로 ESC로 닫힌 상태였더라도 드롭다운을 다시 열 수 있게 강제로 리셋한다.
  // DOM 포커스가 이미 input에 있던 경우(예: 직전 검색 실행 후) inputRef.focus()는 focus 이벤트를 재발생시키지
  // 않아 focused 상태가 갱신되지 않으므로, setFocused(true)로 명시적으로 맞춰준다.
  const handleClearQuery = () => {
    setQuery("");
    setSuggestions([]);
    setDismissed(false);
    setFocused(true);
    inputRef.current?.focus();
    // 입력만 비우면 화면은 여전히 옛 검색 결과다 — 주소의 q도 같이 걷어내 목록과 입력창이
    // 어긋나지 않게 한다(#238). 검색을 새로 실행한 게 아니라 되돌린 것이므로 히스토리를
    // 쌓지 않도록 replace를 쓰고, /search가 아니면(헤더) 아무것도 하지 않는다.
    if (pathname === "/search" && searchParams.get("q")) {
      router.replace(searchUrlWithoutQuery(), { scroll: false });
    }
  };

  const hasQuery = query.trim().length > 0;
  const showDropdown =
    focused && !dismissed && hasQuery && (suggestions.length > 0 || searchStatus === "done");
  const showRecentDropdown =
    focused && !dismissed && query.trim().length === 0 && recentSearches.length > 0;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && highlightedIndex >= 0) {
      // 하이라이트된 항목이 있을 때만 가로챈다 — 없으면 기존 form onSubmit(→ /search?q=)이 그대로 처리한다.
      e.preventDefault();
      selectSuggestion(suggestions[highlightedIndex]);
    } else if (e.key === "Escape") {
      setDismissed(true);
    }
  };

  return (
    <div className={`relative ${width}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={`flex items-center gap-2 ${CONTAINER_STYLES[variant]} ${FOCUS_STYLES[variant]}`}
      >
        {/* 헤더(default)는 왼쪽 돋보기가 곧 제출 버튼이고, 마켓은 이 돋보기를 장식용(비클릭)으로
            두고 아래 오른쪽 빨간 CTA가 제출을 맡는다. */}
        {variant === "default" && (
          <button type="submit" aria-label="검색" className="flex flex-shrink-0 items-center">
            <SearchIcon stroke="#9A9AA2" />
          </button>
        )}
        {variant === "market" && (
          <span className="flex flex-shrink-0 items-center pl-1.5" aria-hidden="true">
            <SearchIcon stroke="#9A9AA2" />
          </span>
        )}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder={PLACEHOLDER_TEXT[variant]}
          spellCheck={false}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-activedescendant={
            showDropdown && highlightedIndex >= 0
              ? `${listboxId}-option-${highlightedIndex}`
              : undefined
          }
          className={`w-full border-none bg-transparent text-ink outline-none ${INPUT_STYLES[variant]}`}
        />
        {query.length > 0 && (
          <button
            type="button"
            aria-label="검색어 지우기"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleClearQuery}
            className="flex flex-shrink-0 items-center text-[#9A9AA2] hover:text-ink"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
        {/* 버튼 텍스트("검색")가 곧 접근 이름이라 aria-label을 따로 두지 않는다 — 두면
            스크린리더가 라벨만 읽고 화면의 텍스트와 어긋난다. */}
        {variant === "market" && (
          <button type="submit" className={MARKET_SUBMIT_BUTTON}>
            검색
          </button>
        )}
      </form>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[95] min-h-[52px] overflow-hidden rounded-[12px] border border-[#EDEDF0] bg-white shadow-[0_14px_38px_rgba(20,26,52,0.18)]">
          <div id={listboxId} role="listbox">
            {suggestions.length > 0 && (
              <div className="max-h-[280px] overflow-y-auto">
                {suggestions.map((card, i) => (
                  <button
                    key={card.id}
                    id={`${listboxId}-option-${i}`}
                    role="option"
                    aria-selected={i === highlightedIndex}
                    ref={(el) => {
                      itemRefs.current[i] = el;
                    }}
                    type="button"
                    // mousedown에서 preventDefault로 input의 blur 자체를 막아 클릭이 확실히 반영되게 한다.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectSuggestion(card)}
                    className={`flex w-full items-center gap-2.5 border-l-[3px] py-2 pl-[9px] pr-3 text-left ${
                      i === highlightedIndex
                        ? "border-secondary bg-lavender"
                        : "border-transparent hover:bg-[#FAFAFB]"
                    }`}
                  >
                    <div className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-[7px] bg-[#F2F2F5]">
                      <CardImage
                        src={card.imageSmall}
                        alt={pickDisplayName(card, query)}
                        label="카드"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className={`truncate text-[13px] font-bold ${
                          i === highlightedIndex ? "text-secondary" : "text-ink"
                        }`}
                      >
                        {highlightMatch(pickDisplayName(card, query), query)}
                      </div>
                      <div className="truncate text-[11.5px] text-[#9A9AA2]">
                        {formatSetAndRarity(card.setName, card.rarity)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {suggestions.length === 0 && (
            <div aria-live="polite" className="px-3 py-4 text-center text-[13px] text-[#9A9AA2]">
              검색 결과가 없습니다.
            </div>
          )}
          {suggestions.length > 0 && totalElements > 8 && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => runSearch(query)}
              className="block w-full border-t border-[#F0F0F0] px-3 py-2.5 text-center text-[13px] font-bold text-secondary hover:bg-[#FAFAFB]"
            >
              전체 결과 보기
            </button>
          )}
        </div>
      )}

      {showRecentDropdown && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[95] overflow-hidden rounded-[12px] border border-[#EDEDF0] bg-white shadow-[0_14px_38px_rgba(20,26,52,0.18)]">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-[11.5px] font-semibold text-[#9A9AA2]">최근 검색어</span>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleClearRecent}
              className="text-[11.5px] font-semibold text-[#9A9AA2] hover:text-primary"
            >
              최근 검색어 지우기
            </button>
          </div>
          <div className="max-h-[280px] overflow-y-auto">
            {recentSearches.map((term) => (
              <div
                key={term}
                className="group flex w-full items-center gap-1 pr-2 hover:bg-[#FAFAFB]"
              >
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => runSearch(term)}
                  className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-[13px] text-ink"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#9A9AA2"
                    strokeWidth="2"
                    className="flex-shrink-0"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 3" />
                  </svg>
                  <span className="truncate">{term}</span>
                </button>
                <button
                  type="button"
                  aria-label={`${term} 삭제`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleRemoveRecent(term)}
                  className="flex flex-shrink-0 items-center p-1 text-[#C5C5CC] hover:text-primary"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
