"use client";

import { Suspense, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import CardImage from "@/components/CardImage";
import Avatar from "@/components/Avatar";
import { useEscapeAndScrollLock } from "@/hooks/useEscapeAndScrollLock";
import { fetchCardsByKeywordPage } from "@/lib/cardApi";
import { highlightMatch } from "@/lib/highlightMatch";
import { pickDisplayName } from "@/lib/pickDisplayName";
import {
  addRecentSearch,
  clearRecentSearches,
  getRecentSearches,
  removeRecentSearch,
} from "@/lib/recentSearches";
import { notifStyle, formatNotifTime } from "@/lib/notificationDisplay";
import { CardResponse } from "@/types/card";
import { NotificationResponse } from "@/types/notification";
import { useUserStore } from "@/store/useUserStore";
import { useNotificationStore } from "@/store/useNotificationStore";

// 자동완성 API 호출 최소 글자 수 — 1글자는 노이즈가 많아 2글자부터 호출한다.
const MIN_QUERY_LENGTH = 2;

const NAV: { label: string; href: string }[] = [
  { label: "마켓", href: "/search" },
  { label: "시세 랭킹", href: "/ranking" },
  { label: "AI 등급진단", href: "/ai-diagnosis" },
  { label: "상품 등록", href: "/listings/new" },
];

// 헤더에서 동시에 하나만 열릴 수 있는 오버레이 — 알림/프로필 드롭다운과 모바일 메뉴 드로어가
// 각자 독립된 state였을 때, 하나가 열린 채로 다른 트리거를 누르면 그 백드롭이 클릭을 가로채
// "열려던 것 대신 지금 열린 것만 닫히는" 문제가 있었다. 하나의 값으로 합쳐 상호배타를 타입
// 레벨에서 보장한다 — Header(단, LoggedInRight에 props로 전달)가 유일하게 소유한다.
type HeaderPanel = "notif" | "profile" | "menu" | null;

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
    setRecentSearches(addRecentSearch(card.nameKo ?? card.name));
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

// href가 없으면 아직 화면이 없는 메뉴다. 설정은 /settings 신설 후 연결한다.
const PROFILE_MENU: { label: string; href?: string }[] = [
  { label: "마이페이지", href: "/mypage" },
  { label: "내 상품 관리", href: "/listings/me" },
  { label: "워치리스트", href: "/watchlist" },
  { label: "포인트 충전", href: "/mypage/points/charge" },
  { label: "설정", href: "/settings" },
];

// 관리자에게만 붙는 항목. role이 확정되기 전에는 null이라 자연히 숨겨진다.
const ADMIN_MENU: { label: string; href?: string }[] = [
  { label: "관리자 콘솔", href: "/admin/dashboard" },
];

function LoggedInRight({
  open,
  setOpen,
}: {
  open: HeaderPanel;
  setOpen: (value: HeaderPanel | ((prev: HeaderPanel) => HeaderPanel)) => void;
}) {
  const notifId = useId();
  const profileId = useId();
  const router = useRouter();
  const nickname = useUserStore((s) => s.nickname);
  const profileImageUrl = useUserStore((s) => s.profileImageUrl);
  const email = useUserStore((s) => s.email);
  const role = useUserStore((s) => s.role);
  const logout = useUserStore((s) => s.logout);

  // 알림 조회+30초 폴링은 useNotificationStore가 앱 전체에서 유일하게 소유한다.
  // Header는 로그인 상태인 동안(마운트~언마운트) 그 생명주기를 관리하는 역할 — 마운트 시
  // start()(멱등)로 폴링을 켜고, 로그아웃으로 언마운트되면 stop()으로 정리한다.
  const notifications = useNotificationStore((s) => s.notifications);
  const loadState = useNotificationStore((s) => s.loadState);
  const errorMessage = useNotificationStore((s) => s.errorMessage);
  const startNotifications = useNotificationStore((s) => s.start);
  const stopNotifications = useNotificationStore((s) => s.stop);
  const retryNotifications = useNotificationStore((s) => s.retry);
  const markOneRead = useNotificationStore((s) => s.markOneRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);

  // /app/notifications/page.tsx와 동일한 정책 — cardId가 있으면 읽음 여부와 무관하게 항상
  // 카드 상세로 이동하고, 드롭다운은 페이지 전환 후 열려있지 않도록 닫는다. cardId가 없는
  // 알림(문의 처리 등)은 기존처럼 읽음 처리만 하고 드롭다운은 그대로 둔다.
  const handleNotificationClick = (n: NotificationResponse) => {
    markOneRead(n);
    if (n.cardId != null) {
      setOpen(null);
      router.push(`/cards/${n.cardId}`);
    }
  };

  useEffect(() => {
    startNotifications();
    return () => stopNotifications();
  }, [startNotifications, stopNotifications]);

  // 알림 드롭다운을 열 때, 직전 조회가 에러였다면 폴링 주기를 기다리지 않고 바로 재시도한다.
  const toggle = (which: "notif" | "profile") =>
    setOpen((o) => {
      const next = o === which ? null : which;
      if (next === "notif" && loadState === "error") retryNotifications();
      return next;
    });

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const notifLabel = unreadCount > 0 ? `안 읽은 알림 ${unreadCount}개` : "알림";

  return (
    <div className="relative flex items-center gap-4">
      <SearchBar width="hidden w-60 md:block" />
      <button
        onClick={() => toggle("notif")}
        aria-label={notifLabel}
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
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 01-3.4 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute right-2 top-[7px] h-[7px] w-[7px] rounded-full border-[1.5px] border-neutral bg-primary" />
        )}
      </button>
      <button
        onClick={() => toggle("profile")}
        aria-label="프로필"
        aria-expanded={open === "profile"}
        aria-controls={profileId}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-[14px] font-bold text-white"
      >
        <Avatar path={profileImageUrl} nickname={nickname} size={40} />
      </button>

      {/* 알림/프로필 패널(및 백드롭)은 <header>(sticky+z-50)가 만드는 스태킹 컨텍스트에 갇히면
          같은 z-index라도 header 바깥의 다른 오버레이(예: /search 필터 바텀시트)와 정확히 비교되지
          않는다. document.body로 Portal해서 header 스태킹 컨텍스트 밖으로 완전히 빼낸다 - 이때
          absolute 위치(right-*, top-*)가 기존과 동일하게 보이도록, header와 같은 좌우 패딩(px-4
          sm:px-10)을 가진 얇은 fixed 래퍼를 여기서도 그대로 재현한다(top-52px였던 값은 이 래퍼의
          top이 header 상단과 같아졌으므로 header 높이 그대로인 top-16으로 치환). */}
      {(open === "notif" || open === "profile") &&
        createPortal(
          <div
            onClick={() => setOpen(null)}
            aria-hidden="true"
            className="fixed inset-x-0 bottom-0 top-16 z-[80]"
          />,
          document.body,
        )}

      {open === "notif" &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-0 top-0 z-[90] px-4 sm:px-10">
            <div
              id={notifId}
              aria-label="알림 목록"
              className="pointer-events-auto absolute right-[44px] top-16 w-[344px] overflow-hidden rounded-[14px] border border-[#EDEDF0] bg-white shadow-[0_14px_38px_rgba(20,26,52,0.18)]"
            >
              <div className="flex items-center justify-between border-b border-[#F0F0F0] px-4 py-3.5">
                <span className="text-[14.5px] font-extrabold">알림</span>
                <button
                  type="button"
                  onClick={markAllRead}
                  className="cursor-pointer text-xs font-bold text-secondary hover:text-secondary-dark"
                >
                  모두 읽음 처리
                </button>
              </div>
              <div className="max-h-[340px] overflow-y-auto">
                {loadState === "loading" && (
                  <div className="px-4 py-8 text-center text-[13px] text-[#9A9AA2]">
                    불러오는 중...
                  </div>
                )}
                {loadState === "error" && (
                  <div
                    role="alert"
                    className="mx-4 my-3 rounded-[12px] border border-[#F6C6C6] bg-[#FFF1F1] px-4 py-3 text-center text-[13px] font-semibold text-[#C21414]"
                  >
                    {errorMessage}
                  </div>
                )}
                {loadState === "ready" && notifications.length === 0 && (
                  <div className="px-4 py-8 text-center text-[13px] text-[#9A9AA2]">
                    새 알림이 없습니다.
                  </div>
                )}
                {loadState === "ready" &&
                  notifications.length > 0 &&
                  notifications.map((n) => {
                    const style = notifStyle(n.type);
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => handleNotificationClick(n)}
                        className={`flex w-full cursor-pointer gap-[11px] border-b border-[#F5F5F7] px-4 py-[13px] text-left hover:bg-[#FAFAFB] ${!n.isRead ? "bg-[#FFF7F7]" : ""}`}
                      >
                        <span
                          className={`mt-[15px] h-[7px] w-[7px] flex-shrink-0 rounded-full ${!n.isRead ? "bg-primary" : "bg-transparent"}`}
                        />
                        {/* /app/notifications/page.tsx와 동일한 정책 — cardImageUrl 있으면 카드
                            썸네일, 없으면(또는 조회 실패) 기존 타입 아이콘. 좁은 드롭다운이라도
                            34px 그대로 유지(전체 목록과 다른 크기 분기를 또 만들지 않는다). */}
                        {n.cardImageUrl ? (
                          <div className="relative h-[34px] w-[34px] flex-shrink-0 overflow-hidden rounded-[9px] bg-[#F2F2F5]">
                            {/* 실제 카드 이미지를 대조해 보면 일러스트 프레임이 카드 세로 기준
                                대략 5~51% 지점에 있다 — object-top으로 상단부터 잘라낸 뒤 그
                                프레임만 꽉 채우도록 scale+origin으로 확대한다. */}
                            <CardImage
                              src={n.cardImageUrl}
                              alt=""
                              rounded="rounded-[9px]"
                              className="origin-[50%_19%] scale-150 object-top"
                            />
                          </div>
                        ) : (
                          <div
                            className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[9px]"
                            style={{ background: style.tint }}
                          >
                            {style.icon}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div
                            className={`text-[13px] leading-[1.4] text-ink ${!n.isRead ? "font-bold" : "font-semibold"}`}
                          >
                            {n.message}
                          </div>
                          <div className="mt-[3px] text-[11px] text-[#B0B0B8]">
                            {formatNotifTime(n.createdAt)}
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>
              <Link
                href="/notifications"
                onClick={() => setOpen(null)}
                className="block border-t border-[#F0F0F0] px-4 py-[13px] text-center text-[13px] font-bold text-secondary hover:bg-[#FAFAFB]"
              >
                전체 알림 보기
              </Link>
            </div>
          </div>,
          document.body,
        )}

      {open === "profile" &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-0 top-0 z-[90] px-4 sm:px-10">
            <div
              id={profileId}
              aria-label="프로필 메뉴"
              className="pointer-events-auto absolute right-0 top-16 w-[260px] overflow-hidden rounded-[14px] border border-[#EDEDF0] bg-white shadow-[0_14px_38px_rgba(20,26,52,0.18)]"
            >
              <div className="flex items-center gap-3 px-4 py-[18px]">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-base font-extrabold text-white">
                  <Avatar path={profileImageUrl} nickname={nickname} size={44} />
                </div>
                <div className="min-w-0">
                  <div className="text-[14.5px] font-extrabold">{nickname ?? "사용자"}</div>
                  <div className="truncate text-xs text-[#9A9AA2]">{email ?? ""}</div>
                </div>
              </div>
              <div className="h-px bg-[#F0F0F0]" />
              <div className="p-2">
                {(role === "admin" ? [...ADMIN_MENU, ...PROFILE_MENU] : PROFILE_MENU).map((m) =>
                  m.href ? (
                    <Link
                      key={m.label}
                      href={m.href}
                      // 이동해도 드롭다운이 새 페이지 위에 남는다 — pathname 변화 감지는 모바일 메뉴만 닫는다.
                      onClick={() => setOpen(null)}
                      className="flex items-center gap-2.5 rounded-[9px] px-3 py-2.5 text-[13.5px] font-semibold text-[#3A3A42] hover:bg-[#F5F5F7] hover:text-ink"
                    >
                      {m.label}
                    </Link>
                  ) : (
                    <div
                      key={m.label}
                      aria-disabled="true"
                      className="flex cursor-default items-center gap-2.5 rounded-[9px] px-3 py-2.5 text-[13.5px] font-semibold text-[#B4B4BC]"
                    >
                      <span className="flex-1">{m.label}</span>
                      <span className="text-[10.5px] font-bold">준비 중</span>
                    </div>
                  ),
                )}
              </div>
              <div className="h-px bg-[#F0F0F0]" />
              <div className="p-2">
                <button
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
          </div>,
          document.body,
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

  const mobileMenuId = useId();
  // 알림/프로필 드롭다운(LoggedInRight)과 모바일 메뉴 드로어가 이 값 하나를 공유한다 —
  // 동시에 하나만 열릴 수 있어서, 하나가 열린 채로 다른 트리거를 눌러도 백드롭끼리
  // 클릭을 가로채는 충돌이 타입 레벨에서 아예 발생하지 않는다.
  const [open, setOpen] = useState<HeaderPanel>(null);
  // ESC/스크롤락은 모바일 메뉴에만 좁게 적용 — 알림/프로필 드롭다운은 이 state 통합 이전과
  // 동일하게 이 동작이 없던 상태를 그대로 유지한다(의도적으로 범위를 넓히지 않음).
  useEscapeAndScrollLock(open === "menu", () => setOpen(null));

  // 페이지 이동(네비 링크 클릭 외의 경로 — 뒤로가기 등) 시에도 열려있던 모바일 메뉴를 닫는다.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    if (open === "menu") setOpen(null);
  }

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-[#F0F0F0] bg-white px-4 sm:px-10">
      <div className="flex items-center gap-11">
        <Link
          href="/"
          className="whitespace-nowrap text-xl font-extrabold tracking-[-0.5px] text-primary hover:text-primary"
        >
          POCKET TRADE
        </Link>
        <nav className="hidden items-center gap-[30px] text-[15px] font-semibold md:flex">
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
            <SearchBar width="hidden w-56 md:block" />
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

        {/* 관리자도 결국 로그인한 사용자다 — 알림·마이페이지·로그아웃이 똑같이 필요하므로
            LoggedInRight를 그대로 쓰고 운영자 배지만 앞에 붙인다. 따로 만들어두면 일반 메뉴가
            바뀔 때마다 관리자 쪽이 뒤처지고, 실제로 로그아웃 수단이 없는 상태였다. */}
        {(variant === "in" || variant === "admin") && (
          <>
            {variant === "admin" && (
              <span className="whitespace-nowrap rounded-full border border-[#F6D0D0] bg-[#FFF5F5] px-[11px] py-[5px] text-xs font-extrabold text-primary">
                운영자
              </span>
            )}
            <LoggedInRight open={open} setOpen={setOpen} />
          </>
        )}

        <button
          type="button"
          aria-label={open === "menu" ? "메뉴 닫기" : "메뉴 열기"}
          aria-expanded={open === "menu"}
          aria-controls={mobileMenuId}
          onClick={() => setOpen((o) => (o === "menu" ? null : "menu"))}
          className="flex h-10 w-10 items-center justify-center rounded-[9px] bg-neutral transition-colors hover:bg-[#ECECEF] md:hidden"
        >
          {open === "menu" ? (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#4B4B52"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#4B4B52"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M4 6h16" />
              <path d="M4 12h16" />
              <path d="M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* 알림/프로필 패널과 같은 이유로 header 스태킹 컨텍스트 밖(document.body)으로 Portal한다.
          header가 더 이상 containing block이 아니므로 top-full 대신 header 높이 그대로인
          top-16을 쓰고, left-0 right-0는 이미 전체 폭이라 별도 좌우 패딩 래퍼 없이 그대로 fixed로 바꾼다. */}
      {open === "menu" &&
        createPortal(
          <>
            <div
              onClick={() => setOpen(null)}
              aria-hidden="true"
              className="fixed inset-x-0 bottom-0 top-16 z-[80] md:hidden"
            />
            <div
              id={mobileMenuId}
              aria-label="메뉴"
              className="fixed inset-x-0 top-16 z-[90] border-b border-[#EDEDF0] bg-white p-4 shadow-[0_14px_38px_rgba(20,26,52,0.18)] md:hidden"
            >
              {/* 관리자만 모바일 메뉴에서 검색이 빠져 있었다 — 같은 원인(관리자를 별종 취급)의 누락. */}
              {variant !== "loading" && (
                <div className="mb-3">
                  <SearchBar width="w-full" />
                </div>
              )}
              <nav className="flex flex-col gap-1">
                {NAV.map((n) => {
                  const isActive =
                    n.href !== "#" && (pathname === n.href || pathname.startsWith(n.href + "/"));
                  return (
                    <Link
                      key={n.label}
                      href={n.href}
                      onClick={() => setOpen(null)}
                      className={
                        isActive
                          ? "rounded-[9px] bg-[#FFF5F5] px-3 py-2.5 text-[14.5px] font-bold text-primary"
                          : "rounded-[9px] px-3 py-2.5 text-[14.5px] font-semibold text-[#3A3A42] hover:bg-[#F5F5F7]"
                      }
                    >
                      {n.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </>,
          document.body,
        )}
    </header>
  );
}
