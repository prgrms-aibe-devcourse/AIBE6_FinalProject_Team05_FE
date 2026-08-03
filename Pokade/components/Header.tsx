"use client";

import { Suspense, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import CardImage from "@/components/CardImage";
import { fetchCardsByKeywordPage } from "@/lib/cardApi";
import { highlightMatch } from "@/lib/highlightMatch";
import {
  addRecentSearch,
  clearRecentSearches,
  getRecentSearches,
  removeRecentSearch,
} from "@/lib/recentSearches";
import { CardResponse } from "@/types/card";
import { useUserStore } from "@/store/useUserStore";

// 자동완성 API 호출 최소 글자 수 — 1글자는 노이즈가 많아 2글자부터 호출한다.
const MIN_QUERY_LENGTH = 2;

const NAV: { label: string; href: string }[] = [
  { label: "마켓", href: "/search" },
  { label: "AI 등급진단", href: "/ai-diagnosis" },
  { label: "커뮤니티", href: "#" },
];

function SearchBar({ width = "w-60" }: { width?: string }) {
  // useSearchParams는 Suspense 경계가 필요 — Header는 모든 페이지에 걸쳐있으므로
  // 이 부분만 분리해 나머지 정적 페이지의 prerender를 막지 않는다.
  return (
    <Suspense fallback={<SearchBarShell width={width} />}>
      <SearchBarInner width={width} />
    </Suspense>
  );
}

function SearchBarShell({ width = "w-60" }: { width?: string }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-[9px] border border-[#ECECEF] bg-neutral px-3 py-2 ${width}`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9A9AA2" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4-4" />
      </svg>
      <input
        placeholder="카드 이름으로 검색"
        disabled
        className="w-full border-none bg-transparent text-[13.5px] text-ink outline-none"
      />
    </div>
  );
}

function SearchBarInner({ width = "w-60" }: { width?: string }) {
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

  // 최근 검색어 — 포커스 전에는 렌더되지 않으므로 lazy init으로 즉시 로드해도 하이드레이션에 영향 없음.
  const [recentSearches, setRecentSearches] = useState<string[]>(() => getRecentSearches());

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
    setRecentSearches(addRecentSearch(trimmed));
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const submit = () => runSearch(query);

  const selectSuggestion = (card: CardResponse) => {
    inputRef.current?.blur();
    setQuery("");
    setSuggestions([]);
    setRecentSearches(addRecentSearch(card.name));
    router.push(`/cards/${card.id}`);
  };

  const handleClearRecent = () => {
    clearRecentSearches();
    setRecentSearches([]);
  };

  const handleRemoveRecent = (term: string) => {
    setRecentSearches(removeRecentSearch(term));
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
        className="flex items-center gap-2 rounded-[9px] border border-[#ECECEF] bg-neutral px-3 py-2"
      >
        <button type="submit" aria-label="검색" className="flex flex-shrink-0 items-center">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#9A9AA2"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4-4" />
          </svg>
        </button>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder="카드 이름으로 검색"
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
                      <CardImage src={card.imageSmall} alt={card.name} label="카드" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className={`truncate text-[13px] font-bold ${
                          i === highlightedIndex ? "text-secondary" : "text-ink"
                        }`}
                      >
                        {highlightMatch(card.name, query)}
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

type Notif = {
  tint: string;
  icon: React.ReactNode;
  unread: boolean;
  text: string;
  sub: string;
  time: string;
};

const NOTIFS: Notif[] = [
  {
    tint: "#FFF6DA",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#B8860B" strokeWidth="2">
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    unread: true,
    text: "워치리스트 목표가 도달",
    sub: "리자몽 ex · ₩150,000 도달",
    time: "3분 전",
  },
  {
    tint: "#EEF0FA",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#3B4CCA" strokeWidth="2">
        <path d="M3 8l9-5 9 5v8l-9 5-9-5z" />
        <path d="M3 8l9 5 9-5" />
      </svg>
    ),
    unread: true,
    text: "거래 상태 변경 · 검수 완료",
    sub: "TX-20260720-4471",
    time: "1시간 전",
  },
  {
    tint: "#FDEDED",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#EE1515" strokeWidth="2">
        <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
      </svg>
    ),
    unread: true,
    text: "AI 진단 완료",
    sub: "뮤츠 ex · 예상 등급 S",
    time: "3시간 전",
  },
  {
    tint: "#EEF0F2",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
    unread: false,
    text: "신규 메시지 도착",
    sub: "불꽃컬렉터: 발송 완료했습니다",
    time: "어제",
  },
  {
    tint: "#E8F7EF",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v10M9 10h4.5a1.5 1.5 0 010 3H9" />
      </svg>
    ),
    unread: false,
    text: "포인트 충전 완료",
    sub: "진단권 +30회 적립",
    time: "2일 전",
  },
];

const PROFILE_MENU: { label: string; href: string }[] = [
  { label: "마이페이지", href: "#" },
  { label: "내 매물 관리", href: "#" },
  { label: "워치리스트", href: "/watchlist" },
  { label: "포인트 충전", href: "#" },
  { label: "설정", href: "#" },
];

function LoggedInRight() {
  const [open, setOpen] = useState<null | "notif" | "profile">(null);
  const toggle = (which: "notif" | "profile") => setOpen((o) => (o === which ? null : which));
  const notifId = useId();
  const profileId = useId();
  const router = useRouter();
  const nickname = useUserStore((s) => s.nickname);
  const email = useUserStore((s) => s.email);
  const logout = useUserStore((s) => s.logout);

  return (
    <div className="relative flex items-center gap-4">
      <SearchBar />
      <button
        onClick={() => toggle("notif")}
        aria-label="알림"
        aria-haspopup="true"
        aria-expanded={open === "notif"}
        aria-controls={notifId}
        className="relative flex h-10 w-10 items-center justify-center rounded-[9px] bg-neutral transition-colors hover:bg-[#ECECEF]"
      >
        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#4B4B52"
          strokeWidth="2"
        >
          <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 01-3.4 0" />
        </svg>
        <span className="absolute right-2 top-[7px] h-[7px] w-[7px] rounded-full border-[1.5px] border-neutral bg-primary" />
      </button>
      <button
        onClick={() => toggle("profile")}
        aria-label="프로필"
        aria-haspopup="true"
        aria-expanded={open === "profile"}
        aria-controls={profileId}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-[14px] font-bold text-white"
      >
        {nickname?.charAt(0) ?? "U"}
      </button>

      {open && (
        <div onClick={() => setOpen(null)} aria-hidden="true" className="fixed inset-0 z-[80]" />
      )}

      {open === "notif" && (
        <div
          id={notifId}
          aria-label="알림 목록"
          className="absolute right-[44px] top-[52px] z-[90] w-[344px] overflow-hidden rounded-[14px] border border-[#EDEDF0] bg-white shadow-[0_14px_38px_rgba(20,26,52,0.18)]"
        >
          <div className="flex items-center justify-between border-b border-[#F0F0F0] px-4 py-3.5">
            <span className="text-[14.5px] font-extrabold">알림</span>
            <span className="cursor-pointer text-xs font-bold text-secondary hover:text-secondary-dark">
              모두 읽음 처리
            </span>
          </div>
          <div className="max-h-[340px] overflow-y-auto">
            {NOTIFS.map((n, i) => (
              <div
                key={i}
                className={`flex cursor-pointer gap-[11px] border-b border-[#F5F5F7] px-4 py-[13px] hover:bg-[#FAFAFB] ${n.unread ? "bg-[#FFF7F7]" : ""}`}
              >
                <span
                  className={`mt-[15px] h-[7px] w-[7px] flex-shrink-0 rounded-full ${n.unread ? "bg-primary" : "bg-transparent"}`}
                />
                <div
                  className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[9px]"
                  style={{ background: n.tint }}
                >
                  {n.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-[13px] leading-[1.4] text-ink ${n.unread ? "font-bold" : "font-semibold"}`}
                  >
                    {n.text}
                  </div>
                  <div className="mt-px text-xs text-[#9A9AA2]">{n.sub}</div>
                  <div className="mt-[3px] text-[11px] text-[#B0B0B8]">{n.time}</div>
                </div>
              </div>
            ))}
          </div>
          <Link
            href="#"
            className="block border-t border-[#F0F0F0] px-4 py-[13px] text-center text-[13px] font-bold text-secondary hover:bg-[#FAFAFB]"
          >
            전체 알림 보기
          </Link>
        </div>
      )}

      {open === "profile" && (
        <div
          id={profileId}
          role="menu"
          aria-label="프로필 메뉴"
          className="absolute right-0 top-[52px] z-[90] w-[260px] overflow-hidden rounded-[14px] border border-[#EDEDF0] bg-white shadow-[0_14px_38px_rgba(20,26,52,0.18)]"
        >
          <div className="flex items-center gap-3 px-4 py-[18px]">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-base font-extrabold text-white">
              {nickname?.charAt(0) ?? "U"}
            </div>
            <div className="min-w-0">
              <div className="text-[14.5px] font-extrabold">{nickname ?? "사용자"}</div>
              <div className="truncate text-xs text-[#9A9AA2]">{email ?? ""}</div>
            </div>
          </div>
          <div className="h-px bg-[#F0F0F0]" />
          <div className="p-2">
            {PROFILE_MENU.map((m) => (
              <Link
                key={m.label}
                href={m.href}
                role="menuitem"
                className="flex items-center gap-2.5 rounded-[9px] px-3 py-2.5 text-[13.5px] font-semibold text-[#3A3A42] hover:bg-[#F5F5F7] hover:text-ink"
              >
                {m.label}
              </Link>
            ))}
          </div>
          <div className="h-px bg-[#F0F0F0]" />
          <div className="p-2">
            <button
              role="menuitem"
              onClick={async () => {
                setOpen(null);
                await logout();
                router.push("/");
              }}
              className="flex w-full items-center gap-2.5 rounded-[9px] px-3 py-2.5 text-left text-[13.5px] font-bold text-primary hover:bg-[#FFF5F5] hover:text-primary"
            >
              로그아웃
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Header() {
  const pathname = usePathname() || "/";
  const isLoggedIn = useUserStore((s) => s.isLoggedIn);
  const status = useUserStore((s) => s.status);
  const role = useUserStore((s) => s.role);
  const variant: "loading" | "in" | "out" | "admin" =
    status === "loading"
      ? "loading"
      : status === "unauthenticated"
        ? "out"
        : role === "admin"
          ? "admin"
          : "in";

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-[#F0F0F0] bg-white px-10">
      <div className="flex items-center gap-11">
        <Link
          href="/"
          className="whitespace-nowrap text-xl font-extrabold tracking-[-0.5px] text-primary hover:text-primary"
        >
          POCKET TRADE
        </Link>
        <nav className="flex items-center gap-[30px] text-[15px] font-semibold">
          {NAV.map((n) => {
            const isActive =
              n.href !== "#" && (pathname === n.href || pathname.startsWith(n.href + "/"));
            return (
              <Link
                key={n.label}
                href={n.href}
                className={
                  isActive
                    ? "whitespace-nowrap border-b-2 border-primary py-1 text-primary hover:text-primary"
                    : "whitespace-nowrap py-1 text-[#4B4B52] hover:text-primary"
                }
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-4">
        {variant === "loading" && <div className="h-10 w-10 rounded-full bg-neutral" />}
        {variant === "out" && (
          <>
            <SearchBar width="w-56" />
            <Link
              href="/login"
              className="whitespace-nowrap px-1.5 py-2 text-[14.5px] font-bold text-[#4B4B52] hover:text-primary"
            >
              로그인
            </Link>
            <Link
              href="/signup"
              className="whitespace-nowrap rounded-[10px] border-2 border-primary-dark bg-primary px-[18px] py-[9px] text-[14.5px] font-bold text-white shadow-tactile-sm hover:bg-[#D91212] hover:text-white"
            >
              회원가입
            </Link>
          </>
        )}

        {variant === "in" && <LoggedInRight />}

        {variant === "admin" && (
          <>
            <span className="whitespace-nowrap rounded-full border border-[#F6D0D0] bg-[#FFF5F5] px-[11px] py-[5px] text-xs font-extrabold text-primary">
              운영자
            </span>
            <button
              aria-label="알림"
              className="relative flex h-10 w-10 items-center justify-center rounded-[9px] bg-neutral transition-colors hover:bg-[#ECECEF]"
            >
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#4B4B52"
                strokeWidth="2"
              >
                <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.7 21a2 2 0 01-3.4 0" />
              </svg>
              <span className="absolute right-2 top-[7px] h-[7px] w-[7px] rounded-full border-[1.5px] border-neutral bg-primary" />
            </button>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy text-[14px] font-bold text-white">
              관
            </div>
          </>
        )}
      </div>
    </header>
  );
}
