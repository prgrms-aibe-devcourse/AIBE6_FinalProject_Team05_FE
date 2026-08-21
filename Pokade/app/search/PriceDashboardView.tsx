"use client";

import { useEffect, useState } from "react";
import GradeBadge from "@/components/GradeBadge";
import CardImage from "@/components/CardImage";
import AddWatchlistModal from "@/components/AddWatchlistModal";
import { fetchCardsByKeywordPage, fetchCardTrades } from "@/lib/cardApi";
import { fetchWatchlistCounts } from "@/lib/watchlistApi";
import { ListingGrade, TradeSummaryResponse } from "@/types/price";
import { useTimedFlag } from "@/hooks/useTimedFlag";

// MyTradesSection.tsx의 formatDateTime과 같은 모양이지만, 그 파일은 다른 담당자(마이페이지) 소유라
// 공용 헬퍼로 뽑지 않고 이 화면 안에 로컬로 둔다.
function formatTradeTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// GradeBadge는 S/A/B(자체 AI 등급)만 지원한다 — PSA10/9/8(외부 공인등급)은 cards/[id]/page.tsx가
// 이미 그러듯 GradeBadge를 확장하지 않고 이 화면에서 로컬로 처리한다. grade가 null이면(등급 없는
// 원본 거래) GradeBadge에 grade를 안 넘겨 컴포넌트 자체 "등급 미정" 폴백을 그대로 쓴다.
function TradeGradeBadge({ grade }: { grade: ListingGrade | null }) {
  if (grade === "S" || grade === "A" || grade === "B") {
    return <GradeBadge grade={grade} size="sm" />;
  }
  if (grade == null) {
    return <GradeBadge size="sm" />;
  }
  return (
    <span className="inline-flex items-center justify-center rounded-full border-2 border-[#D5D7DC] bg-[#EEF0F2] px-[8px] py-[2px] text-[9px] font-bold leading-none tracking-[0.5px] text-[#5F6368] shadow-sm">
      {grade}
    </span>
  );
}

// /search의 "시세 대시보드" 탭 — 아직 단일 카드(리자몽 ex) 시연용 정적 뷰라 카드 목록/시세는
// 여전히 목업이다. 워치리스트 버튼만 실제 등록이 되도록, 화면에 표시된 카드("리자몽 ex")를
// app/page.tsx의 HERO_CARD와 동일한 방식(이름으로 검색 후 externalId로 확정)으로 조회한다.
const DASHBOARD_CARD = {
  externalId: "sv3pt5-6",
  name: "Charizard ex",
};

export default function PriceDashboardView() {
  const [watchlistModalOpen, setWatchlistModalOpen] = useState(false);
  const [watchlistAdded, triggerWatchlistAdded] = useTimedFlag(2000);
  const [cardId, setCardId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchCardsByKeywordPage(DASHBOARD_CARD.name)
      .then((page) => {
        if (cancelled) return;
        const match = page.content.find((c) => c.externalId === DASHBOARD_CARD.externalId);
        if (match) setCardId(match.id);
      })
      .catch(() => {
        // 조회 실패 시 cardId가 null로 남아 워치리스트 버튼이 비활성 상태를 유지한다.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // "최근 거래 내역"만 실제 API로 연동한다(차트/요약카드/추천카드는 이번 범위 밖, 여전히 목업).
  // 결과를 조회에 쓰인 cardId(key)와 한 덩어리로 들고 있고, 로딩 여부는 별도 플래그가 아니라
  // "지금 cardId에 대한 결과가 아직 없다"로 파생 계산한다 — MyTradesSection.tsx/notifications
  // 페이지와 동일한 패턴(effect 안에서 setState를 동기 호출하면 react-hooks/set-state-in-effect에
  // 걸린다, #162 HANDOFF 참고).
  const [tradesResult, setTradesResult] = useState<{
    key: number;
    data: TradeSummaryResponse[] | null;
  } | null>(null);

  useEffect(() => {
    if (cardId == null) return;
    let cancelled = false;
    const key = cardId;

    fetchCardTrades(cardId)
      .then((data) => {
        if (!cancelled) setTradesResult({ key, data });
      })
      .catch(() => {
        if (!cancelled) setTradesResult({ key, data: null });
      });

    return () => {
      cancelled = true;
    };
  }, [cardId]);

  const currentTrades = tradesResult?.key === cardId ? tradesResult : null;
  const trades = currentTrades?.data ?? null;
  const tradesLoadState: "loading" | "error" | "ready" =
    cardId != null && currentTrades !== null ? (trades ? "ready" : "error") : "loading";

  // "워치리스트에 추가" 버튼 텍스트에 붙는 관심수. 조회 실패는 조용히 무시 — 버튼은 그대로 정상 동작해야 한다.
  const [watchlistCount, setWatchlistCount] = useState<number | null>(null);

  useEffect(() => {
    if (cardId == null) return;
    let cancelled = false;
    const key = cardId;

    fetchWatchlistCounts([cardId])
      .then((counts) => {
        if (!cancelled) setWatchlistCount(counts.get(key) ?? null);
      })
      .catch(() => {
        if (!cancelled) setWatchlistCount(null);
      });

    return () => {
      cancelled = true;
    };
  }, [cardId]);

  return (
    <div className="grid grid-cols-1 items-start gap-[22px] lg:grid-cols-[60fr_40fr]">
      <div className="flex flex-col gap-5">
        <div className="rounded-2xl border border-t-[3px] border-[#EDEDF0] border-t-primary bg-white px-7 py-[26px]">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[13.5px] font-semibold text-[#8A8A92]">리자몽 ex (S) 시세</div>
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
          <div className="grid grid-cols-3 border-b border-[#EDEDF0] pb-[11px] text-xs font-bold text-[#9A9AA2]">
            <span>등급</span>
            <span>체결가</span>
            <span className="text-right">시각</span>
          </div>
          {/* 실제 API(GET /api/prices/{cardId}/trades)에는 변동률 필드가 없다 — 이 표 한 줄
              한 줄이 서로 다른 등급(PSA10/S/등급없음 등)을 섞어 보여주므로, 바로 위 줄과
              비교해 변동률을 계산하면 등급이 다른 거래끼리 비교하는 셈이라 의미가 없다.
              그래서 억지로 만들지 않고 컬럼 자체를 뺐다. */}
          {tradesLoadState === "loading" && (
            <p className="py-8 text-center text-[13px] text-[#8A8A92]">불러오는 중...</p>
          )}
          {tradesLoadState === "error" && (
            <p className="py-8 text-center text-[13px] text-[#C21414]">
              거래 내역을 불러오지 못했습니다.
            </p>
          )}
          {tradesLoadState === "ready" && trades && trades.length === 0 && (
            <p className="py-8 text-center text-[13px] text-[#8A8A92]">
              아직 체결된 거래가 없습니다.
            </p>
          )}
          {tradesLoadState === "ready" &&
            trades &&
            trades.length > 0 &&
            trades.map((t, i) => (
              <div
                key={`${t.tradedAt}-${i}`}
                className={`grid grid-cols-3 items-center py-3 text-[13.5px] ${i < trades.length - 1 ? "border-b border-[#F5F5F7]" : ""}`}
              >
                <span>
                  <TradeGradeBadge grade={t.grade} />
                </span>
                <span className="font-bold">{t.price.toLocaleString("ko-KR")}원</span>
                <span className="text-right text-[#9A9AA2]">{formatTradeTime(t.tradedAt)}</span>
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
          <button
            type="button"
            onClick={() => setWatchlistModalOpen(true)}
            disabled={cardId == null}
            className="mt-[18px] w-full rounded-[11px] border-2 border-primary-dark bg-primary py-3 text-[14.5px] font-bold text-white shadow-tactile-sm active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {watchlistCount
              ? `워치리스트에 추가 (${watchlistCount.toLocaleString("ko-KR")})`
              : "워치리스트에 추가"}
          </button>
          {watchlistAdded && (
            <div className="mt-2 text-center text-[12.5px] font-bold text-primary">등록됨</div>
          )}

          {cardId != null && (
            <AddWatchlistModal
              isOpen={watchlistModalOpen}
              onClose={() => setWatchlistModalOpen(false)}
              cardId={cardId}
              onSuccess={triggerWatchlistAdded}
            />
          )}
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
  );
}
