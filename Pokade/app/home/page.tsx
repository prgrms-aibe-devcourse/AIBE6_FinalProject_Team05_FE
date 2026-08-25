"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import GradeBadge from "@/components/GradeBadge";
import ConditionBar from "@/components/ConditionBar";
import CardImage from "@/components/CardImage";
import HeroTiltCard from "@/components/HeroTiltCard";
import IconTooltip from "@/components/IconTooltip";
import ImageLightbox from "@/components/ImageLightbox";
import Toast from "@/components/Toast";
import { CardSearchItem, toCardSearchItem } from "@/types/card";
import { CardPriceSummaryResponse, PriceRankingResponse } from "@/types/price";
import {
  fetchCards,
  fetchCardsByKeywordPage,
  fetchPriceRanking,
  fetchPriceSummaries,
} from "@/lib/cardApi";
import { ApiError } from "@/lib/apiClient";
import { resolvePriceDisplay } from "@/lib/priceDisplay";
import { useHeartPunch } from "@/hooks/useHeartPunch";
import { useWatchlistMap } from "@/hooks/useWatchlistMap";
import { useToast } from "@/hooks/useToast";
import { showWatchlistToggleToast } from "@/lib/watchlistToast";

// 실시간 시세 티커 포맷 헬퍼 — RankingList.tsx의 동일 로직과 톤을 맞춘다.
function formatWon(price: number): string {
  return `₩${price.toLocaleString("ko-KR")}`;
}

function formatChangeRate(rate: number): string {
  return `${rate > 0 ? "▲" : rate < 0 ? "▼" : ""} ${Math.abs(rate).toFixed(1)}%`;
}

// 인기 카드 그리드 칸 수 — 이 수만큼만 인기순 카드를 요청한다.
const POPULAR_CARDS_SIZE = 5;

// 히어로 섹션에 노출할 대표 카드 (sm3-20 Charizard-GX / Burning Shadows).
const HERO_CARD = {
  externalId: "sm3-20",
  name: "Charizard-GX",
  alt: "Charizard-GX · Burning Shadows · Rare Holo GX · Fire · Mitsuhiro Arita · No.20/147",
  image: "https://images.scrydex.com/pokemon/sm3-20/large",
};

const STEPS = [
  {
    n: "01",
    t: "카드 등록 & AI 진단",
    d: "사진 업로드만으로 AI가 상태를 자동 분석해 예상 등급과 시세를 알려드립니다.",
  },
  {
    n: "02",
    t: "안전결제 & 전문 검수",
    d: "결제 금액은 Pokade가 안전하게 보관하고, 실물 카드도 직접 검수합니다.",
  },
  {
    n: "03",
    t: "수령 확인 & 정산",
    d: "구매자 수령 확인 후 판매자에게 정산됩니다. 문제 발생 시 100% 환불을 보장합니다.",
  },
];

const PRICE_STEPS = [
  {
    n: "01",
    t: "카드별 실거래 시세",
    d: "등급별 요약가와 체결 차트로 지금 이 카드의 가격이 적정한지 바로 확인하세요.",
  },
  {
    n: "02",
    t: "급등락 랭킹 TOP 10",
    d: "최근 7일 평균 체결가 등락률을 기준으로, 지금 뜨는 카드를 한눈에 보여드립니다.",
  },
  {
    n: "03",
    t: "전체 거래 현황",
    d: "플랫폼 전체 거래량과 평균 체결가 추이를 매일 업데이트해 알려드립니다.",
  },
];

type LoadState = "loading" | "error" | "ready";

// 하트가 쓰는 useQuickWatchlistToggle이 useSearchParams(로그인 후 복귀 URL 조립)를 부르므로,
// /search·/cards/[id]와 같은 모양으로 Suspense 경계를 둔다 — 없으면 Next.js가 정적 프리렌더를
// 포기하며 빌드에서 막는다.
export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomeView />
    </Suspense>
  );
}

function HomeView() {
  const { toast, showToast, pauseToast, resumeToast } = useToast();
  const { triggerPunch, punchKey, punchClass } = useHeartPunch();
  // 하트에 필요한 워치리스트 상태 한 세트(마켓과 공용) — 상태만 담당하고, 토스트·펀치는
  // handleHeartClick이 돌려주는 결과를 보고 아래 버튼에서 직접 처리한다.
  const { myWatchlist, handleHeartClick, pendingCardId } = useWatchlistMap();

  const [popularCards, setPopularCards] = useState<CardSearchItem[]>([]);
  const [priceSummaries, setPriceSummaries] = useState<Map<number, CardPriceSummaryResponse>>(
    new Map(),
  );
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [isHeroCardOpen, setIsHeroCardOpen] = useState(false);
  const [heroCardId, setHeroCardId] = useState<number | null>(null);

  const [tickerItems, setTickerItems] = useState<PriceRankingResponse[]>([]);

  // 실시간 시세 티커 — 로그인 필요 API라(비로그인은 401) 실패해도 나머지 화면은
  // 그대로 정상 동작해야 하므로 조용히 빈 상태로 둔다(섹션 자체가 안 보임).
  useEffect(() => {
    let cancelled = false;

    Promise.all([fetchPriceRanking("rise"), fetchPriceRanking("fall")])
      .then(([rise, fall]) => {
        if (!cancelled) setTickerItems([...rise, ...fall]);
      })
      .catch(() => {
        // 티커는 그냥 안 보이면 됨 - 별도 에러 UI 없음.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchCardsByKeywordPage(HERO_CARD.name)
      .then((page) => {
        if (cancelled) return;
        const match = page.content.find((c) => c.externalId === HERO_CARD.externalId);
        if (match) setHeroCardId(match.id);
      })
      .catch(() => {
        // 상세 페이지 링크만 못 만들 뿐, 히어로 카드 표시 자체는 계속 정상 동작해야 함.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchCards({ sort: "popular", size: POPULAR_CARDS_SIZE })
      .then((responses) => {
        if (cancelled) return;
        setPopularCards(responses.map(toCardSearchItem));
        setLoadState("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMessage(err instanceof ApiError ? err.message : "인기 카드를 불러오지 못했습니다.");
        setLoadState("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // 인기 카드 목록이 바뀌면 가격을 한 번에 배치 조회한다.
  // 가격 조회 실패는 카드 목록 자체를 막지 않고, 실패한 카드는 기존처럼 "가격 정보 준비중"으로 남는다.
  useEffect(() => {
    if (popularCards.length === 0) return;
    let cancelled = false;

    fetchPriceSummaries(
      popularCards.map((c) => c.id),
      {
        grade: "S",
        includeRecentTradePrice: true,
      },
    )
      .then((summaries) => {
        if (!cancelled) setPriceSummaries(summaries);
      })
      .catch(() => {
        // 가격 조회 실패는 조용히 무시 — 카드 목록은 이미 정상 표시된 상태를 유지한다.
      });

    return () => {
      cancelled = true;
    };
  }, [popularCards]);

  return (
    <main className="main-content">
      {/* HERO */}
      <section className="relative overflow-hidden bg-navy px-6 py-12 sm:px-10">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url(/images/hero-bg.jpg)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-navy via-navy/85 to-navy/40" />
        <div className="relative mx-auto flex max-w-container flex-col items-center justify-between gap-10 md:flex-row md:gap-12">
          <div className="max-w-[600px] text-center md:text-left">
            <span className="inline-block rounded-md bg-primary/15 px-3 py-1.5 text-xs font-extrabold tracking-[1.5px] text-[#FF6B6B]">
              EXCLUSIVE DROP
            </span>
            <h1 className="mt-5 text-[32px] font-extrabold leading-[1.18] tracking-[-1px] text-white [text-wrap:balance] sm:text-[44px]">
              믿을 수 있는 카드 거래,
              <br />
              Pokade에서 시작하세요
            </h1>
            <p className="mt-4 max-w-[500px] text-base leading-relaxed text-[#A7ADC4]">
              AI 등급진단과 안전거래 시스템으로 컬렉터가 신뢰하는 포켓몬 카드 마켓플레이스. 지금 내
              카드의 정확한 시세를 확인해보세요.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3.5 md:justify-start">
              <Link
                href="/ai-diagnosis"
                className="rounded-[11px] border-2 border-primary-dark bg-primary px-[26px] py-3.5 text-[15.5px] font-bold text-white shadow-tactile transition hover:text-white hover:shadow-tactile-hover active:translate-y-0.5 active:shadow-tactile-active"
              >
                진단 시작하기
              </Link>
              <Link
                href={heroCardId != null ? `/cards/${heroCardId}` : "#"}
                aria-disabled={heroCardId == null}
                className="rounded-[11px] border-[1.5px] border-white/35 bg-transparent px-[26px] py-3.5 text-[15.5px] font-bold text-white transition hover:border-white hover:bg-white/[0.06] hover:text-white"
              >
                자세히 보기
              </Link>
            </div>
          </div>
          <div className="h-[380px] w-[270px] flex-shrink-0 overflow-visible rounded-[18px] bg-navy-700 shadow-[0_20px_50px_rgba(0,0,0,0.4)] sm:h-[462px] sm:w-[330px]">
            <HeroTiltCard
              src={HERO_CARD.image}
              alt={HERO_CARD.alt}
              onClick={() => setIsHeroCardOpen(true)}
            />
          </div>
        </div>
      </section>

      <ImageLightbox
        isOpen={isHeroCardOpen}
        onClose={() => setIsHeroCardOpen(false)}
        imageSrc={HERO_CARD.image}
        alt={HERO_CARD.alt}
      />

      {/* TICKER — 로그인 필요 API라 비로그인/실패 시엔 섹션 자체를 숨긴다(빈 티커보다 나음). */}
      {tickerItems.length > 0 && (
        <section className="bg-navy-800 px-10">
          <div className="mx-auto flex h-[52px] max-w-container items-stretch overflow-hidden">
            <span className="flex flex-shrink-0 items-center gap-[7px] pr-5 text-[11.5px] font-extrabold tracking-[1px] text-tertiary">
              <span className="h-[7px] w-[7px] rounded-full bg-tertiary" />
              실시간 시세
            </span>
            <div className="flex flex-1 items-center overflow-hidden">
              <div className="flex w-max animate-ticker items-center">
                {[...tickerItems, ...tickerItems].map((t, i) => (
                  <div
                    key={`${t.cardId}-${i}`}
                    className="flex flex-shrink-0 items-center gap-[9px] border-l border-white/[0.08] px-[22px]"
                  >
                    <span className="text-[13.5px] font-semibold text-[#DDE0EC]">
                      {t.cardNameKo ?? t.cardName}
                    </span>
                    <span className="text-[13.5px] font-bold text-white">
                      {formatWon(t.price)}
                    </span>
                    <span
                      className={`text-[12.5px] font-bold ${
                        t.changeRate > 0
                          ? "text-[#FF6B6B]"
                          : t.changeRate < 0
                            ? "text-[#7FA6FF]"
                            : "text-[#8B90A8]"
                      }`}
                    >
                      {formatChangeRate(t.changeRate)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* POPULAR CARDS */}
      <section className="bg-white px-4 py-14 sm:px-10">
        <div className="mx-auto max-w-container">
          <div className="mb-[26px] flex items-end justify-between">
            <div>
              <h2 className="m-0 text-[26px] font-extrabold tracking-[-0.5px]">인기 카드</h2>
              <p className="mt-1.5 text-sm text-[#8A8A92]">가장 주목받은 카드</p>
            </div>
            <Link href="/search" className="text-sm font-bold text-primary hover:text-primary-dark">
              전체보기 &gt;
            </Link>
          </div>
          {loadState === "loading" && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 lg:gap-[18px]">
              {Array.from({ length: POPULAR_CARDS_SIZE }).map((_, i) => (
                <div
                  key={i}
                  className="flex flex-col overflow-hidden rounded-[14px] border border-[#EDEDF0]"
                >
                  <div className="aspect-[5/7] w-full animate-pulse bg-[#F2F2F5]" />
                  <div className="flex flex-1 flex-col gap-2 p-3.5">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-[#F2F2F5]" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-[#F2F2F5]" />
                    <div className="mt-auto h-4 w-2/3 animate-pulse rounded bg-[#F2F2F5]" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {loadState === "error" && (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-[#EDEDF0] bg-white py-24">
              <span className="text-[13.5px] font-bold text-[#D14343]">{errorMessage}</span>
            </div>
          )}

          {loadState === "ready" && popularCards.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-[#EDEDF0] bg-white py-24">
              <span className="text-[13.5px] font-semibold text-[#8A8A92]">
                인기 카드를 준비 중입니다.
              </span>
            </div>
          )}

          {loadState === "ready" && popularCards.length > 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 lg:gap-[18px]">
              {popularCards.map((c) => {
                const priceDisplay = resolvePriceDisplay(priceSummaries.get(c.id));
                return (
                  <div
                    key={c.id}
                    className="relative flex flex-col overflow-hidden rounded-[14px] border border-[#EDEDF0] transition hover:-translate-y-1 hover:shadow-lift"
                  >
                    <Link href={`/cards/${c.id}`} className="flex flex-1 cursor-pointer flex-col">
                      <div className="relative aspect-[5/7] w-full bg-[#F2F2F5]">
                        <CardImage src={c.imageUrl} alt={c.name} label="카드" />
                      </div>
                      <div className="flex flex-1 flex-col p-3.5">
                        <div className="text-[14.5px] font-bold leading-[1.35]">{c.name}</div>
                        <div className="mt-[3px] text-xs text-[#9A9AA2]">{c.set}</div>
                        <div className="mt-auto flex items-end justify-between pt-3.5">
                          <div>
                            <div className="text-[11px] text-[#9A9AA2]">
                              {priceDisplay?.label ?? "최근 시세"}
                            </div>
                            <div className="text-base font-extrabold text-ink">
                              {priceDisplay?.price ?? (
                                <span className="text-[13px] font-semibold text-[#9A9AA2]">
                                  가격 정보 준비중
                                </span>
                              )}
                            </div>
                          </div>
                          {/* 좋아요 버튼이 차지하던 자리를 그대로 예약해 가격 텍스트와 겹치지 않게 함 */}
                          <div className="h-9 w-9 flex-shrink-0" aria-hidden="true" />
                        </div>
                      </div>
                    </Link>
                    {/* 툴팁은 위로 — 하트가 타일 맨 아래에 있어 아래로 열면 타일의
                        overflow-hidden에 잘린다(마켓 타일과 같은 이유). */}
                    <IconTooltip
                      label={myWatchlist.has(c.id) ? "관심 해제" : "관심 등록"}
                      placement="top"
                      className="absolute bottom-3.5 right-3.5"
                    >
                      <button
                        onClick={async () => {
                          // 서버가 등록을 확정한 뒤에만 펀치(useHeartPunch 주석 참고) —
                          // 클릭 시점 상태로 미리 재생하면 등록이 실패해도 하트가 튀어올라
                          // 성공한 것처럼 보인다.
                          const result = await handleHeartClick(c.id);
                          if (result.status === "added") triggerPunch(c.id);
                          showWatchlistToggleToast(result, showToast);
                        }}
                        disabled={pendingCardId === c.id}
                        aria-label={myWatchlist.has(c.id) ? "관심 해제" : "관심 등록"}
                        className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-[#EDEDF0] bg-white hover:border-primary hover:bg-[#FFF5F5] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <svg
                          key={punchKey(c.id)}
                          className={punchClass(c.id)}
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          stroke="#EE1515"
                          strokeWidth="2"
                          fill={myWatchlist.has(c.id) ? "#EE1515" : "none"}
                        >
                          <path
                            d="M19 14c1.5-1.5 3-3.3 3-5.5A3.5 3.5 0 0018.5 5c-1.6 0-3 1-3.5 2.5C14.5 6 13.1 5 11.5 5A3.5 3.5 0 008 8.5c0 2.2 1.5 4 3 5.5l4 4z"
                            transform="translate(-3 0)"
                          />
                        </svg>
                      </button>
                    </IconTooltip>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* PRICE INFO INTRO — 아래 SAFE TRADING JOURNEY와 같은 톤의 기능 소개 섹션.
          라이브 데이터 위젯이 아니라 Pokade의 시세 정보가 어떤 걸 보여주는지 소개만 한다.
          3개 항목이 카드 상세/마켓 인사이트 등 서로 다른 화면에 걸쳐 있어 단일 CTA로
          묶을 수 없으므로 버튼은 의도적으로 두지 않는다. */}
      <section className="bg-neutral px-10 py-14">
        <div className="mx-auto max-w-container">
          <div className="mb-[38px] text-center">
            <h2 className="m-0 text-[26px] font-extrabold tracking-[-0.5px]">
              감이 아니라, 실거래 데이터로 확인하는 시세
            </h2>
            <p className="mt-2 text-[14.5px] text-[#8A8A92]">
              Pokade는 실제 체결 데이터를 기반으로 지금 이 카드의 적정가를 알려드립니다
            </p>
          </div>
          <div className="grid grid-cols-3 gap-[22px]">
            {PRICE_STEPS.map((s) => (
              <div key={s.n} className="rounded-[14px] border border-[#EDEDF0] bg-white px-7 py-[30px]">
                <div className="text-[40px] font-extrabold leading-none tracking-[-1px] text-tertiary">
                  {s.n}
                </div>
                <h3 className="mb-2 mt-4 text-lg font-bold">{s.t}</h3>
                <p className="m-0 text-sm leading-relaxed text-[#7A7A82]">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SAFE TRADING JOURNEY */}
      <section className="bg-white px-10 py-14">
        <div className="mx-auto max-w-container">
          <div className="mb-[38px] text-center">
            <h2 className="m-0 text-[26px] font-extrabold tracking-[-0.5px]">
              안전한 거래, 세 단계면 충분합니다
            </h2>
            <p className="mt-2 text-[14.5px] text-[#8A8A92]">
              Pokade가 검수부터 정산까지 책임집니다
            </p>
          </div>
          <div className="grid grid-cols-3 gap-[22px]">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-[14px] border border-[#EDEDF0] px-7 py-[30px]">
                <div className="text-[40px] font-extrabold leading-none tracking-[-1px] text-tertiary">
                  {s.n}
                </div>
                <h3 className="mb-2 mt-4 text-lg font-bold">{s.t}</h3>
                <p className="m-0 text-sm leading-relaxed text-[#7A7A82]">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI DIAGNOSIS INTRO */}
      <section className="bg-neutral px-10 py-14">
        <div className="mx-auto grid max-w-container grid-cols-2 items-center gap-11">
          <div>
            <span className="inline-block rounded-md bg-[#FFF3CE] px-3 py-1.5 text-xs font-extrabold tracking-[1px] text-[#8A6A00]">
              AI GRADING
            </span>
            <h2 className="mt-[18px] text-[30px] font-extrabold leading-[1.25] tracking-[-0.8px]">
              사진 한 장으로
              <br />내 카드 등급을 미리 확인
            </h2>
            <p className="mt-4 max-w-[440px] text-[15px] leading-[1.65] text-[#6E6E76]">
              모서리·중앙정렬·스크래치를 AI가 분석해 예상 등급을 알려드립니다. 정식 감정 전, 내
              카드의 가치를 가볍게 확인해보세요.
            </p>
            <Link
              href="/ai-diagnosis"
              className="mt-7 inline-block rounded-[11px] border-2 border-primary-dark bg-primary px-[26px] py-3.5 text-[15px] font-bold text-white shadow-tactile transition hover:text-white hover:shadow-tactile-hover active:translate-y-0.5 active:shadow-tactile-active"
            >
              무료로 진단하기
            </Link>
          </div>
          <div className="flex gap-5 rounded-2xl border-t-[3px] border-secondary bg-white p-6 shadow-card">
            <div className="relative h-[180px] w-[130px] flex-shrink-0 overflow-hidden rounded-[11px] bg-[#F2F2F5]">
              {/* 진단 결과 예시 카드. src 없이 두면 회색 플레이스홀더만 보여 미완성으로 읽힌다.
                  히어로와 같은 대표 카드(sm3-20)를 그대로 쓴다. */}
              <CardImage src={HERO_CARD.image} alt={HERO_CARD.alt} />
              <GradeBadge grade="S" size="sm" className="absolute left-2 top-2" />
            </div>
            <div className="flex-1">
              <div className="text-xs font-semibold text-[#9A9AA2]">진단 결과</div>
              <div className="mt-0.5 text-[19px] font-extrabold">종합 9.2 / 10</div>
              <div className="mt-4 flex flex-col gap-3">
                {[
                  ["모서리", "9.4", 9],
                  ["중앙정렬", "9.0", 8],
                  ["표면 스크래치", "9.1", 9],
                ].map(([l, v, f]) => (
                  <div key={l as string}>
                    <div className="mb-[5px] flex justify-between text-xs">
                      <span className="font-semibold text-[#7A7A82]">{l}</span>
                      <span className="font-bold">{v}</span>
                    </div>
                    <ConditionBar filled={f as number} size="sm" color="bg-secondary" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <Toast toast={toast} onPause={pauseToast} onResume={resumeToast} />
    </main>
  );
}
