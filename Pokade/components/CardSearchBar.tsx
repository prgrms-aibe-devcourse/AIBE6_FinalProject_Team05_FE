"use client";

import { Suspense, useEffect, useId, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import CardImage from "@/components/CardImage";
import { fetchCardsByKeywordPage } from "@/lib/cardApi";
import { highlightMatch } from "@/lib/highlightMatch";
import { pickDisplayName } from "@/lib/pickDisplayName";
import { useRecentSearchesStore } from "@/store/useRecentSearchesStore";
import { CardResponse } from "@/types/card";

// 자동완성 API 호출 최소 글자 수 — 1글자는 노이즈가 많아 2글자부터 호출한다.
const MIN_QUERY_LENGTH = 2;

type SearchBarVariant = "default" | "market";

// variant="market": 마켓 페이지(/search) 상단 "카드 검색" 카드(흰 배경) 안에 놓이므로,
// 자체 배경/그림자를 넣으면 흰 카드 안에 흰 카드가 겹치는 이중 박싱이 된다 — 배경 없이
// 테두리(입력 필드라는 걸 alert 없이도 알 수 있게)만 남긴다. 대신 오른쪽 제출 버튼을
// 빨간 CTA로 올려서(#235) 눌러야 할 대상이 무엇인지 분명히 한다 — 입체감(shadow-tactile)은
// 이 프로젝트에서 "누를 수 있는 것"에만 쓰는 표시라 입력 필드 본체에는 넣지 않는다.
// 헤더는 기존 스타일(variant="default") 그대로 유지 — 이번 개선 범위가 아니다.
const CONTAINER_STYLES: Record<SearchBarVariant, string> = {
  default: "rounded-[9px] border-[#DDDDE3] bg-neutral px-3.5 py-2.5",
  market: "rounded-[11px] border-[#DDDDE3] p-1.5",
};
const FOCUS_STYLES: Record<SearchBarVariant, string> = {
  default: "transition focus-within:border-primary",
  market:
    "transition-[box-shadow,border-color] duration-200 focus-within:border-primary focus-within:shadow-[0_0_0_4px_rgba(238,21,21,0.08)]",
};

// 마켓 전용 제출 버튼 — 포인트 충전 CTA(app/mypage/points/charge/page.tsx)와 같은 언어.
// 44x44라 터치 타겟도 그대로 만족한다.
// rest(sm) → hover(살짝 부상) → active(눌림)의 3단 피드백. hover는 기존 shadow-tactile-hover
// 토큰 재사용, transform/box-shadow만 움직여 200ms transition 안에서 매끄럽게 전환된다.
const MARKET_SUBMIT_BUTTON =
  "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[9px] border-2 border-primary-dark bg-primary text-white shadow-tactile-sm transition hover:-translate-y-[1px] hover:shadow-tactile-hover active:translate-y-0.5 active:shadow-tactile-active";

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
    <div className={`flex items-center gap-2 border ${CONTAINER_STYLES[variant]} ${width}`}>
      {variant === "default" && <SearchIcon stroke="#9A9AA2" />}
      {/* 마켓은 왼쪽에 장식용(비클릭) 돋보기 — 제출은 오른쪽 빨간 CTA가 맡는다. */}
      {variant === "market" && (
        <span className="flex flex-shrink-0 items-center pl-1.5" aria-hidden="true">
          <SearchIcon stroke="#9A9AA2" />
        </span>
      )}
      <input
        placeholder="카드 이름으로 검색"
        disabled
        className="w-full border-none bg-transparent text-[13.5px] text-ink outline-none"
      />
      {/* 실제 폼(SearchBarInner)과 높이가 같아야 로딩→실제 전환 시 튀지 않는다. */}
      {variant === "market" && (
        <span className={MARKET_SUBMIT_BUTTON}>
          <SearchIcon stroke="#FFFFFF" />
        </span>
      )}
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

  // 검색 실행(직접 입력 Enter, 최근 검색어 클릭) 공통 경로 — 검색어를 최근 검색어에 저장한 뒤 이동.
  const runSearch = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return; // 빈 검색어는 BE가 400을 반환하므로 요청 자체를 막는다.
    inputRef.current?.blur();
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
        className={`flex items-center gap-2 border ${CONTAINER_STYLES[variant]} ${FOCUS_STYLES[variant]}`}
      >
        {/* 헤더(default)는 기존처럼 왼쪽 돋보기가 곧 제출 버튼이다. 마켓은 이 자리를 비우고
            아래 오른쪽에 빨간 CTA 제출 버튼을 둔다(#235). */}
        {variant === "default" && (
          <button type="submit" aria-label="검색" className="flex flex-shrink-0 items-center">
            <SearchIcon stroke="#9A9AA2" />
          </button>
        )}
        {/* 마켓은 왼쪽에 장식용(비클릭) 돋보기 — 제출은 오른쪽 빨간 CTA가 맡는다. */}
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
          placeholder="카드 이름으로 검색"
          spellCheck={false}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-activedescendant={
            showDropdown && highlightedIndex >= 0
              ? `${listboxId}-option-${highlightedIndex}`
              : undefined
          }
          className="w-full border-none bg-transparent text-[13.5px] text-ink outline-none"
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
        {variant === "market" && (
          <button type="submit" aria-label="검색" className={MARKET_SUBMIT_BUTTON}>
            <SearchIcon stroke="#FFFFFF" />
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
                        {card.setName} · {card.rarity}
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
