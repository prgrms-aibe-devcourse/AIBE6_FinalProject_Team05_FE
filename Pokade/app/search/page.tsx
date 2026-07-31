"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import GradeBadge, { Grade, GRADE_DESCRIPTIONS } from "@/components/GradeBadge";
import CardImage from "@/components/CardImage";
import { CardSearchItem, toCardSearchItem } from "@/types/card";
import { CardPriceSummaryResponse } from "@/types/price";
import {
  CardSort,
  fetchCardsByKeywordPage,
  fetchCardsPage,
  fetchPriceSummaries,
} from "@/lib/cardApi";
import { ApiError } from "@/lib/apiClient";
import { highlightMatch } from "@/lib/highlightMatch";

// buyPrice(즉시구매가) 우선, 없으면 sellPrice(판매호가)를 대신 보여준다 — 둘 다 없으면 null.
function priceLabel(summary?: CardPriceSummaryResponse): string | null {
  const price = summary?.buyPrice ?? summary?.sellPrice;
  return price != null ? `${price.toLocaleString("ko-KR")}원` : null;
}

const PRICE_MAX = 3000000;

// size 파라미터를 넘기지 않을 때 BE 기본 페이지 size(cardApi.ts 주석 참고)와 맞춘 스켈레톤 칸 수.
const SEARCH_SKELETON_COUNT = 20;

// 세트 체크박스 → BE expansionId 매핑. data.sql에 실제 시드된 세트 중 4개만 노출.
const SET_OPTIONS: { label: string; expansionId: string }[] = [
  { label: "베이스", expansionId: "base1" },
  { label: "151", expansionId: "sv3pt5" },
  { label: "블랙 볼트", expansionId: "zsv10pt5" },
  { label: "메가 에볼루션", expansionId: "me1" },
];

// 타입/레어도 체크박스 값 — 실행 중인 BE(/api/cards)에서 집계한 실제 값·빈도 기준.
// 등장 빈도 내림차순, 동률은 알파벳순. JA 카드 1건의 값(草/通常)은 영문 카드 기준이라 제외.
const TYPE_OPTIONS = ["Fire", "Water", "Lightning", "Fairy", "Fighting", "Psychic"];
const RARITY_OPTIONS = [
  "Double Rare",
  "Common",
  "Rare Holo",
  "Rare Holo GX",
  "Illustration Rare",
  "Rare Holo EX",
];

type LoadState = "loading" | "error" | "ready";

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
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(1500000);
  // URL을 직접 조작해 화이트리스트에 없는 값(예: types=INVALID)을 넣어도
  // 체크박스로 선택 가능한 값만 채택한다 — 배열은 유효한 값만 걸러내고
  // 나머지는 유지(전체를 버리지 않음).
  const [selectedExpansionId, setSelectedExpansionId] = useState<string | null>(() => {
    const id = searchParams.get("expansionId");
    return id && SET_OPTIONS.some((o) => o.expansionId === id) ? id : null;
  });
  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    () =>
      searchParams
        .get("types")
        ?.split(",")
        .filter((t) => TYPE_OPTIONS.includes(t)) ?? [],
  );
  const [selectedRarities, setSelectedRarities] = useState<string[]>(
    () =>
      searchParams
        .get("rarity")
        ?.split(",")
        .filter((r) => RARITY_OPTIONS.includes(r)) ?? [],
  );
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
  const filterKey = `${selectedExpansionId}|${selectedTypes.join(",")}|${selectedRarities.join(",")}|${sort}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  useEffect(() => {
    let cancelled = false;

    const request = q
      ? fetchCardsByKeywordPage(q, page - 1)
      : fetchCardsPage({
          expansionId: selectedExpansionId ?? undefined,
          types: selectedTypes,
          rarity: selectedRarities,
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
  }, [reloadKey, selectedExpansionId, selectedTypes, selectedRarities, sort, page, q]);

  // 화면에 보이는 카드가 바뀔 때마다(필터/정렬/페이지 전환 포함) 가격을 한 번에 배치 조회한다.
  // 가격 조회 실패는 카드 목록 자체를 막지 않고, 실패한 카드는 기존처럼 "가격 정보 없음"으로 남는다.
  useEffect(() => {
    if (cards.length === 0) return;
    let cancelled = false;

    fetchPriceSummaries(cards.map((c) => c.id))
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

  // 모바일 바텀시트로 필터가 열려 있는 동안 배경 스크롤 방지.
  useEffect(() => {
    if (!filterOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [filterOpen]);

  // ESC로 모바일 필터 드로어 닫기.
  useEffect(() => {
    if (!filterOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFilterOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [filterOpen]);

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
    if (sort !== "latest") params.set("sort", sort);
    else params.delete("sort");
    if (page > 1) params.set("page", String(page));
    else params.delete("page");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExpansionId, selectedTypes, selectedRarities, sort, page]);

  // 페이지 번호/이전·다음 버튼 클릭 시에만 맨 위로 스크롤 — 필터/정렬 변경으로
  // 인한 자동 setPage(1)은 이 핸들러를 거치지 않으므로 스크롤 동작이 없다.
  const goToPage = (p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetFilters = () => {
    setPriceMin(0);
    setPriceMax(1500000);
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
  const toggleValue = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  const seg = (a: boolean) =>
    `rounded-lg px-[18px] py-[9px] text-[13.5px] cursor-pointer ${a ? "bg-white font-bold text-ink shadow-[0_1px_3px_rgba(0,0,0,0.08)]" : "bg-transparent font-semibold text-[#8A8A92]"}`;

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
              >
                <div
                  className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl border border-[#EDEDF0] bg-white p-[22px] lg:sticky lg:top-[88px] lg:max-h-none lg:w-auto lg:overflow-visible lg:rounded-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[15px] font-extrabold">
                      필터
                      <span
                        tabIndex={0}
                        title={`S: ${GRADE_DESCRIPTIONS.S}\nA: ${GRADE_DESCRIPTIONS.A}\nB: ${GRADE_DESCRIPTIONS.B}`}
                        className="group relative inline-flex h-3.5 w-3.5 shrink-0 cursor-help items-center justify-center rounded-full bg-black/10 text-[8px] font-bold leading-none text-[#6B6B72] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#6B6B72]"
                      >
                        ?
                        <span
                          role="tooltip"
                          className="pointer-events-none absolute left-0 top-[calc(100%+6px)] z-20 w-max max-w-[220px] rounded-md bg-[#1A1A1E] px-2.5 py-1.5 text-[11px] font-medium leading-snug text-white opacity-0 shadow-lift transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100"
                        >
                          <span className="block">
                            <b>S</b>: {GRADE_DESCRIPTIONS.S}
                          </span>
                          <span className="block">
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
                    {SET_OPTIONS.map((opt) => (
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
                    ))}
                  </div>
                  <div className="mb-[18px] h-px bg-[#F0F0F0]" />
                  <div className="mb-[9px] text-[12.5px] font-bold text-[#4B4B52]">타입</div>
                  <div className="mb-5 flex flex-col gap-[9px]">
                    {TYPE_OPTIONS.map((t) => (
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
                    ))}
                  </div>
                  <div className="mb-[18px] h-px bg-[#F0F0F0]" />
                  <div className="mb-[9px] text-[12.5px] font-bold text-[#4B4B52]">레어도</div>
                  <div className="mb-5 flex flex-col gap-[9px]">
                    {RARITY_OPTIONS.map((r) => (
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
                    ))}
                  </div>
                  <div className="mb-[18px] h-px bg-[#F0F0F0]" />
                  <div className="mb-3 text-[12.5px] font-bold text-[#4B4B52]">가격대</div>
                  <div className="mb-3 flex justify-between text-[12.5px] font-bold text-ink">
                    <span>{priceMin.toLocaleString("ko-KR")}원</span>
                    <span>~</span>
                    <span>{priceMax.toLocaleString("ko-KR")}원</span>
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
                      onChange={(e) => setPriceMin(Math.min(+e.target.value, priceMax))}
                      className="dual-range pointer-events-none absolute left-0 top-0 m-0 h-6 w-full appearance-none bg-transparent"
                    />
                    <input
                      type="range"
                      min={0}
                      max={PRICE_MAX}
                      step={50000}
                      value={priceMax}
                      onChange={(e) => setPriceMax(Math.max(+e.target.value, priceMin))}
                      className="dual-range pointer-events-none absolute left-0 top-0 m-0 h-6 w-full appearance-none bg-transparent"
                    />
                  </div>
                  <div className="mt-1.5 flex justify-between text-xs text-[#9A9AA2]">
                    <span>0원</span>
                    <span>3,000,000원</span>
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
                  selectedRarities.length > 0) && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {selectedExpansionId && (
                      <FilterChip
                        label={
                          SET_OPTIONS.find((o) => o.expansionId === selectedExpansionId)?.label ??
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
                  </div>
                )}

              {loadState === "loading" && cards.length === 0 && (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {Array.from({ length: SEARCH_SKELETON_COUNT }).map((_, i) => (
                    <div
                      key={i}
                      className="aspect-[5/7] w-full animate-pulse rounded-[13px] border border-[#EDEDF0] bg-[#F2F2F5]"
                    />
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
                  {cards.map((c) => (
                    <Link
                      key={c.id}
                      href={`/cards/${c.id}`}
                      className="flex cursor-pointer flex-col overflow-hidden rounded-[13px] border border-[#EDEDF0] transition hover:-translate-y-[3px] hover:shadow-lift"
                    >
                      <div className="relative aspect-[5/7] w-full bg-[#F2F2F5]">
                        <CardImage src={c.imageUrl} alt={c.name} label="카드" />
                        {c.grade && (
                          <GradeBadge grade={c.grade} className="absolute left-[9px] top-[9px]" />
                        )}
                      </div>
                      <div className="flex flex-1 flex-col p-3">
                        <div className="text-[13.5px] font-bold">
                          {q ? highlightMatch(c.name, q) : c.name}
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
                        <div className="mt-auto pt-2.5 text-[15px] font-extrabold text-ink">
                          {priceLabel(priceSummaries.get(c.id)) ?? (
                            <span className="text-[13px] font-semibold text-[#9A9AA2]">
                              가격 정보 없음
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
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
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
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
                  ))}
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
        )}

        {!q && view === "dash" && (
          <div className="grid grid-cols-1 items-start gap-[22px] lg:grid-cols-[60fr_40fr]">
            <div className="flex flex-col gap-5">
              <div className="rounded-2xl border border-t-[3px] border-[#EDEDF0] border-t-primary bg-white px-7 py-[26px]">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[13.5px] font-semibold text-[#8A8A92]">
                      리자몽 ex (S) 시세
                    </div>
                    <div className="mt-1.5 flex items-baseline gap-2.5">
                      <span className="text-[32px] font-extrabold tracking-[-1px]">₩142,000</span>
                      <span className="text-sm font-bold text-primary">▲ 3.2% (4,400)</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <span className="rounded-md bg-primary px-[11px] py-[5px] text-xs font-bold text-white">
                      7D
                    </span>
                    <span className="rounded-md bg-[#F2F2F5] px-[11px] py-[5px] text-xs font-bold text-[#8A8A92]">
                      1M
                    </span>
                    <span className="rounded-md bg-[#F2F2F5] px-[11px] py-[5px] text-xs font-bold text-[#8A8A92]">
                      1Y
                    </span>
                  </div>
                </div>
                <div className="mt-6 flex h-[170px] items-end gap-3">
                  {[48, 56, 44, 68].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t-[5px] bg-secondary"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                  {[62, 82, 100].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t-[5px] bg-primary"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
                <div className="mt-2.5 flex justify-between text-[11px] text-[#A8A8B0]">
                  {["7/16", "7/17", "7/18", "7/19", "7/20", "7/21", "오늘"].map((d) => (
                    <span key={d}>{d}</span>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-[#EDEDF0] bg-white px-7 py-6">
                <h2 className="mb-4 mt-0 text-base font-extrabold">최근 거래 내역</h2>
                <div className="grid grid-cols-4 border-b border-[#EDEDF0] pb-[11px] text-xs font-bold text-[#9A9AA2]">
                  <span>등급</span>
                  <span>체결가</span>
                  <span>변동</span>
                  <span className="text-right">시각</span>
                </div>
                {[
                  { g: "S" as Grade, p: "₩142,000", c: "▲ 3.2%", up: true, t: "2분 전" },
                  { g: "A" as Grade, p: "₩98,000", c: "▲ 1.1%", up: true, t: "18분 전" },
                  { g: "S" as Grade, p: "₩139,500", c: "▼ 0.7%", up: false, t: "1시간 전" },
                  { g: "B" as Grade, p: "₩61,000", c: "▲ 2.0%", up: true, t: "3시간 전" },
                ].map((r, i, a) => (
                  <div
                    key={i}
                    className={`grid grid-cols-4 items-center py-3 text-[13.5px] ${i < a.length - 1 ? "border-b border-[#F5F5F7]" : ""}`}
                  >
                    <span>
                      <GradeBadge grade={r.g} size="md" />
                    </span>
                    <span className="font-bold">{r.p}</span>
                    <span className={`font-bold ${r.up ? "text-primary" : "text-secondary"}`}>
                      {r.c}
                    </span>
                    <span className="text-right text-[#9A9AA2]">{r.t}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-5">
              <div className="rounded-2xl border border-[#EDEDF0] bg-white p-6">
                <div className="flex gap-4">
                  <div className="relative h-[132px] w-24 flex-shrink-0 overflow-hidden rounded-[10px] bg-[#F2F2F5]">
                    <CardImage />
                    <GradeBadge grade="S" size="sm" className="absolute left-[7px] top-[7px]" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[17px] font-extrabold">리자몽 ex</div>
                    <div className="mt-[3px] text-[12.5px] text-[#9A9AA2]">흑염의 지배자 · SAR</div>
                    <div className="mt-3.5 flex flex-col gap-[7px] text-[12.5px]">
                      {[
                        ["최고가", "₩158,000"],
                        ["최저가", "₩121,000"],
                        ["거래량(7D)", "342건"],
                      ].map(([k, v]) => (
                        <div key={k} className="flex justify-between">
                          <span className="text-[#8A8A92]">{k}</span>
                          <span className="font-bold">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <button className="mt-[18px] w-full rounded-[11px] border-2 border-primary-dark bg-primary py-3 text-[14.5px] font-bold text-white shadow-tactile-sm active:translate-y-0.5">
                  워치리스트에 추가
                </button>
              </div>
              <div className="rounded-2xl border border-[#EDEDF0] bg-white p-6">
                <h2 className="mb-3.5 mt-0 text-[15px] font-extrabold">추천 카드</h2>
                <div className="flex flex-col gap-3.5">
                  {[
                    { n: "뮤츠 ex", s: "레이징 서프 · SAR", p: "₩211,000", c: "▲ 1.1%", up: true },
                    { n: "뮤 UR", s: "151 · UR", p: "₩89,500", c: "▼ 1.4%", up: false },
                    {
                      n: "칠색조 ex",
                      s: "파라다임 트리거 · SAR",
                      p: "₩118,000",
                      c: "▲ 4.6%",
                      up: true,
                    },
                  ].map((r) => (
                    <div key={r.n} className="flex items-center gap-3">
                      <div className="h-14 w-10 flex-shrink-0 overflow-hidden rounded-[7px] bg-[#F2F2F5]">
                        <CardImage />
                      </div>
                      <div className="flex-1">
                        <div className="text-[13.5px] font-bold">{r.n}</div>
                        <div className="text-[11.5px] text-[#9A9AA2]">{r.s}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[13.5px] font-extrabold">{r.p}</div>
                        <div
                          className={`text-[11.5px] font-bold ${r.up ? "text-primary" : "text-secondary"}`}
                        >
                          {r.c}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
