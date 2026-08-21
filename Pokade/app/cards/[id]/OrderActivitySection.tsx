"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState, useEffect } from "react";
import {
  BuyOfferOrderbookEntryResponse,
  GRADE_LABELS,
  GRADE_ORDER,
  GradeKey,
  ListingSummaryResponse,
  TradeSummaryResponse,
} from "@/types/price";
import { fetchActiveListings, fetchBuyOfferOrderbook, fetchPriceChart } from "@/lib/cardApi";
import { ApiError } from "@/lib/apiClient";
import { loginUrlFor } from "@/lib/authRedirect";
import { useEscapeAndScrollLock } from "@/hooks/useEscapeAndScrollLock";

type LoadState = "loading" | "ready";
type Tab = "trades" | "buy" | "sell";

const TABS: { value: Tab; label: string }[] = [
  { value: "trades", label: "최근 체결" },
  { value: "buy", label: "구매입찰" },
  { value: "sell", label: "판매입찰" },
];

// 구매 박스 안에 작게 보여줄 예시 개수 — 전체는 "전체 거래내역 보기" 모달에서만.
const COMPACT_ROW_LIMIT = 5;

function formatTradedAt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

function gradeKeyOf(grade: string | null): GradeKey {
  return (grade ?? "RAW") as GradeKey;
}

type Row = { key: string | number; grade: GradeKey; price: number; dateLabel?: string };

function toRows(tab: Tab, trades: TradeSummaryResponse[], buys: BuyOfferOrderbookEntryResponse[], sells: ListingSummaryResponse[]): Row[] {
  if (tab === "trades") {
    return trades.map((t, i) => ({ key: i, grade: gradeKeyOf(t.grade), price: t.price, dateLabel: formatTradedAt(t.tradedAt) }));
  }
  if (tab === "buy") {
    return buys.map((o) => ({ key: o.buyOfferId, grade: gradeKeyOf(o.grade), price: o.price }));
  }
  return sells.map((l) => ({ key: l.id, grade: gradeKeyOf(l.grade), price: l.price }));
}

function priceColorClass(tab: Tab) {
  if (tab === "buy") return "text-secondary";
  if (tab === "sell") return "text-primary";
  return "text-ink";
}

// 등급 필터가 적용된 행 목록을 테이블로 렌더링 — 구매 박스 안 요약(limit=5)과 모달(전체) 양쪽에서 공유.
function ActivityTable({ tab, rows, emptyMessage }: { tab: Tab; rows: Row[]; emptyMessage: string }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl bg-neutral py-8 text-center text-[12.5px] text-[#9A9AA2]">{emptyMessage}</div>
    );
  }
  return (
    <table className="w-full text-left text-[12.5px]">
      <thead>
        <tr className="text-[11px] font-semibold text-[#9A9AA2]">
          <th className="pb-1.5 font-semibold">등급</th>
          <th className="pb-1.5 text-right font-semibold">{tab === "trades" ? "거래가" : tab === "buy" ? "입찰가" : "판매가"}</th>
          {tab === "trades" && <th className="pb-1.5 text-right font-semibold">거래일</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className="border-t border-[#F5F5F7]">
            <td className="py-1.5 font-bold">{GRADE_LABELS[r.grade]}</td>
            <td className={`py-1.5 text-right font-bold ${priceColorClass(tab)}`}>{r.price.toLocaleString("ko-KR")}원</td>
            {tab === "trades" && <td className="py-1.5 text-right text-[#8A8A92]">{r.dateLabel}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function GradeFilterPills({
  counts,
  value,
  onChange,
}: {
  counts: Map<GradeKey, number>;
  value: GradeKey | "ALL";
  onChange: (g: GradeKey | "ALL") => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onChange("ALL")}
        className={`rounded-full border px-2.5 py-1 text-[11.5px] font-bold transition ${
          value === "ALL"
            ? "border-primary bg-lavender text-secondary"
            : "border-[#DDDDE3] bg-white text-[#4B4B52] hover:border-primary hover:text-primary"
        }`}
      >
        전체
      </button>
      {GRADE_ORDER.filter((g) => (counts.get(g) ?? 0) > 0).map((g) => (
        <button
          key={g}
          type="button"
          onClick={() => onChange(g)}
          className={`rounded-full border px-2.5 py-1 text-[11.5px] font-bold transition ${
            value === g
              ? "border-primary bg-lavender text-secondary"
              : "border-[#DDDDE3] bg-white text-[#4B4B52] hover:border-primary hover:text-primary"
          }`}
        >
          {GRADE_LABELS[g]} {counts.get(g)}
        </button>
      ))}
    </div>
  );
}

const EMPTY_MESSAGE: Record<Tab, string> = {
  trades: "최근 30일간 체결 내역이 없습니다.",
  buy: "등록된 구매입찰이 없습니다.",
  sell: "등록된 판매입찰이 없습니다.",
};

// 크림(KREAM) 상품 상세의 "구매입찰/판매입찰" 탭을 참고 — 구매 박스(즉시구매가/등급 선택) 바로 아래
// 작게 예시 5건만 보여주고, "전체 거래내역 보기"를 누르면 등급 필터가 있는 모달에서 전체를 볼 수 있다.
// 세 데이터 모두 로그인이 필요한 API라(401 가능) 한 번에 조회해서 인증 여부를 공통으로 처리한다.
export default function OrderActivitySection({ cardId }: { cardId: number }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<Tab>("trades");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalGradeFilter, setModalGradeFilter] = useState<GradeKey | "ALL">("ALL");

  const [recentTrades, setRecentTrades] = useState<TradeSummaryResponse[]>([]);
  const [buyOffers, setBuyOffers] = useState<BuyOfferOrderbookEntryResponse[]>([]);
  const [sellListings, setSellListings] = useState<ListingSummaryResponse[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [authError, setAuthError] = useState<ApiError | null>(null);

  useEscapeAndScrollLock(modalOpen, () => setModalOpen(false));

  useEffect(() => {
    let cancelled = false;

    Promise.allSettled([
      fetchPriceChart(cardId, "30d"),
      fetchBuyOfferOrderbook(cardId),
      fetchActiveListings(cardId),
    ]).then(([tradesResult, buyResult, sellResult]) => {
      if (cancelled) return;

      // 최근 체결 내역은 BE가 오래된순(차트용)으로 주므로, 여기서는 최신순으로 뒤집는다.
      setRecentTrades(tradesResult.status === "fulfilled" ? [...tradesResult.value].reverse() : []);
      setBuyOffers(buyResult.status === "fulfilled" ? buyResult.value : []);
      setSellListings(sellResult.status === "fulfilled" ? sellResult.value : []);

      // 셋 중 하나라도 401/403이면 "로그인 필요" 안내를 우선 보여준다 — 세 API 모두 동일한
      // 인증 요건이라 개별 실패보다 공통 원인(비로그인)일 가능성이 높다.
      const firstAuthFailure = [tradesResult, buyResult, sellResult].find(
        (r) => r.status === "rejected" && r.reason instanceof ApiError && (r.reason.status === 401 || r.reason.status === 403),
      );
      setAuthError(
        firstAuthFailure && firstAuthFailure.status === "rejected" ? (firstAuthFailure.reason as ApiError) : null,
      );
      setLoadState("ready");
    });

    return () => {
      cancelled = true;
    };
  }, [cardId]);

  const allRows = useMemo(
    () => toRows(tab, recentTrades, buyOffers, sellListings),
    [tab, recentTrades, buyOffers, sellListings],
  );
  const compactRows = allRows.slice(0, COMPACT_ROW_LIMIT);

  const gradeCounts = useMemo(() => {
    const counts = new Map<GradeKey, number>();
    for (const row of allRows) {
      counts.set(row.grade, (counts.get(row.grade) ?? 0) + 1);
    }
    return counts;
  }, [allRows]);

  const modalRows = useMemo(
    () => (modalGradeFilter === "ALL" ? allRows : allRows.filter((r) => r.grade === modalGradeFilter)),
    [allRows, modalGradeFilter],
  );

  const openModal = () => {
    setModalGradeFilter("ALL");
    setModalOpen(true);
  };

  return (
    <div>
      <div className="mb-2.5 flex gap-1">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`rounded-[8px] px-2.5 py-1 text-[11.5px] font-bold transition ${
              tab === t.value ? "bg-primary text-white" : "text-[#8A8A92] hover:bg-neutral hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loadState === "loading" && (
        <div className="flex flex-col gap-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-7 animate-pulse rounded-lg bg-[#F2F2F5]" />
          ))}
        </div>
      )}

      {loadState === "ready" && authError && (
        <div className="flex flex-col items-center gap-1.5 rounded-xl bg-neutral py-6 text-center text-[12px] text-[#9A9AA2]">
          <span>입찰·체결 내역은 로그인 후 확인할 수 있습니다.</span>
          <Link href={loginUrlFor(pathname, searchParams)} className="text-[12px] font-bold text-primary hover:text-primary-dark">
            로그인하기
          </Link>
        </div>
      )}

      {loadState === "ready" && !authError && (
        <>
          <ActivityTable tab={tab} rows={compactRows} emptyMessage={EMPTY_MESSAGE[tab]} />

          {allRows.length > 0 && (
            <button
              type="button"
              onClick={openModal}
              className="mt-2 w-full rounded-[9px] border border-[#DDDDE3] bg-white py-1.5 text-[12px] font-bold text-[#4B4B52] transition hover:border-primary hover:text-primary"
            >
              전체 거래내역 보기
            </button>
          )}
        </>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="전체 거래내역"
        >
          <div
            className="flex max-h-[80vh] w-full max-w-[480px] flex-col rounded-2xl bg-white p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[16px] font-extrabold">전체 거래내역</h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="닫기"
                className="flex h-8 w-8 items-center justify-center rounded-full text-[18px] font-bold text-[#9A9AA2] hover:bg-neutral"
              >
                ×
              </button>
            </div>

            <div className="mb-3 flex gap-1.5 border-b border-[#F0F0F3] pb-3">
              {TABS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => {
                    setTab(t.value);
                    setModalGradeFilter("ALL");
                  }}
                  className={`rounded-[9px] px-3.5 py-1.5 text-[13px] font-bold transition ${
                    tab === t.value ? "bg-primary text-white" : "text-[#8A8A92] hover:bg-neutral hover:text-ink"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <GradeFilterPills counts={gradeCounts} value={modalGradeFilter} onChange={setModalGradeFilter} />

            <div className="overflow-y-auto">
              <ActivityTable tab={tab} rows={modalRows} emptyMessage={EMPTY_MESSAGE[tab]} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
