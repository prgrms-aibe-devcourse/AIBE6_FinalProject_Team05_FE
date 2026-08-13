"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CardImage from "@/components/CardImage";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { ApiError } from "@/lib/apiClient";
import { deleteWatchlistItem, fetchWatchlist } from "@/lib/watchlistApi";
import { resolvePriceDisplay } from "@/lib/priceDisplay";
import { WatchlistResponse } from "@/types/watchlist";

type Status = "대기중" | "목표도달" | "확인함";
const STATUS_CLS: Record<Status, string> = {
  대기중: "bg-[#FFF3CE] text-[#8A6A00]",
  목표도달: "bg-[#E8F7EF] text-[#087a4e]",
  확인함: "bg-[#EEF0F2] text-[#6B7280]",
};

// isNotified는 알림 발송 파이프라인이 붙기 전까진 항상 false라 지금은 "목표도달"/"대기중"만 실제로 갈린다.
function resolveStatus(item: WatchlistResponse): Status {
  if (item.isNotified) return "확인함";
  if (item.targetReached) return "목표도달";
  return "대기중";
}

// targetBuyPrice/targetSellPrice 둘 다 있을 수 있어 있는 것만 이어붙인다(BE가 최소 하나는 보장).
function formatTarget(item: WatchlistResponse): string {
  const parts: string[] = [];
  if (item.targetBuyPrice != null) parts.push(`₩${item.targetBuyPrice.toLocaleString("ko-KR")}`);
  if (item.targetSellPrice != null) parts.push(`₩${item.targetSellPrice.toLocaleString("ko-KR")}`);
  return parts.join(" / ");
}

// resolvePriceDisplay()는 검색/홈 화면과 공유하는 "N원" 형식을 그대로 반환하므로, 이 화면에서만
// "₩N" 형식으로 보이도록 접미사(원)를 접두사(₩)로 바꿔치기한다 — 공용 함수 자체는 건드리지 않는다.
function toWonSymbol(formatted: string): string {
  return `₩${formatted.replace(/원$/, "")}`;
}

// changeRate: 최근 7일 vs 이전 7일 S등급 평균 체결가 등락률(%) — 랭킹 페이지와 동일한 표시 규칙.
function ChangeRateBadge({ rate }: { rate: number | null }) {
  if (rate == null) return <span className="text-[13.5px] text-[#9A9AA2]">-</span>;
  const isRise = rate >= 0;
  return (
    <span className={`text-[13.5px] font-bold ${isRise ? "text-primary" : "text-secondary"}`}>
      {isRise ? "▲" : "▼"} {Math.abs(rate).toFixed(1)}%
    </span>
  );
}

type LoadState = "loading" | "error" | "ready";
type Filter = "all" | Status;

const TABS: { key: Filter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "대기중", label: "대기중" },
  { key: "목표도달", label: "목표도달" },
  { key: "확인함", label: "확인함" },
];

export default function WatchlistPage() {
  const authStatus = useRequireAuth();

  const [items, setItems] = useState<WatchlistResponse[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [reloadKey, setReloadKey] = useState(0);

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    let cancelled = false;

    fetchWatchlist()
      .then((data) => {
        if (cancelled) return;
        setItems(data);
        setLoadState("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMessage(err instanceof ApiError ? err.message : "워치리스트를 불러오지 못했습니다.");
        setLoadState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [authStatus, reloadKey]);

  const startDelete = (id: number) => {
    setConfirmDeleteId(id);
    setDeleteError(null);
  };

  const cancelDelete = () => {
    setConfirmDeleteId(null);
    setDeleteError(null);
  };

  const confirmDelete = async (id: number) => {
    setDeletingId(id);
    setDeleteError(null);
    try {
      await deleteWatchlistItem(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      setConfirmDeleteId(null);
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "삭제에 실패했습니다.");
    } finally {
      setDeletingId(null);
    }
  };

  if (authStatus !== "authenticated") {
    return (
      <main className="main-content flex items-center justify-center bg-neutral">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#E7E7EB] border-t-primary" />
      </main>
    );
  }

  const statusCounts: Record<Status, number> = { 대기중: 0, 목표도달: 0, 확인함: 0 };
  items.forEach((item) => {
    statusCounts[resolveStatus(item)] += 1;
  });
  const tabCount = (key: Filter) => (key === "all" ? items.length : statusCounts[key]);
  const filteredItems = items.filter((item) => filter === "all" || resolveStatus(item) === filter);

  const tabCls = (active: boolean) =>
    `rounded-[10px] border-[1.5px] px-[15px] py-2 text-[13.5px] cursor-pointer ${
      active
        ? "border-primary bg-[#FFF5F5] font-bold text-primary"
        : "border-[#E4E4E9] bg-white font-semibold text-[#7A7A82]"
    }`;

  return (
    <main className="main-content bg-neutral px-10 pb-14 pt-9">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-[22px]">
          <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.6px]">워치리스트</h1>
          <p className="mt-1.5 text-sm text-[#8A8A92]">
            관심 카드의 목표가 도달 알림을 관리하세요
          </p>
        </div>

        <div className="mb-[18px] flex gap-2">
          {TABS.map(({ key, label }) => (
            <button key={key} className={tabCls(filter === key)} onClick={() => setFilter(key)}>
              {label} {tabCount(key)}
            </button>
          ))}
        </div>

        {loadState === "loading" && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[#EDEDF0] bg-white py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#E7E7EB] border-t-primary" />
            <span className="text-[13.5px] font-semibold text-[#8A8A92]">
              워치리스트를 불러오는 중입니다...
            </span>
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

        {loadState === "ready" && items.length === 0 && (
          <div className="rounded-2xl border border-[#EDEDF0] bg-white px-10 py-[72px] text-center">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[#F2F2F5]">
              <svg
                width="46"
                height="46"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#C7C7CE"
                strokeWidth="1.6"
              >
                <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 000-7.8z" />
              </svg>
            </div>
            <h3 className="mb-0 mt-[22px] text-lg font-extrabold">아직 관심 카드가 없어요</h3>
            <p className="mt-2.5 text-sm leading-relaxed text-[#8A8A92]">
              마켓에서 카드를 찾아 하트를 눌러보세요.
              <br />
              목표가에 도달하면 알림을 보내드립니다.
            </p>
            <Link
              href="/"
              className="mt-[26px] inline-block rounded-[11px] border-2 border-primary-dark bg-primary px-[26px] py-3 text-[14.5px] font-bold text-white shadow-tactile-sm hover:text-white"
            >
              카드 둘러보기
            </Link>
          </div>
        )}

        {loadState === "ready" && items.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-[#EDEDF0] bg-white">
            <div className="grid grid-cols-[2.4fr_1fr_1fr_1fr_1fr_0.6fr] gap-4 border-b border-[#EDEDF0] bg-[#FAFAFB] px-[22px] py-3.5 text-xs font-bold text-[#9A9AA2]">
              <div>카드</div>
              <div>현재 시세</div>
              <div>목표가</div>
              <div>등락</div>
              <div>상태</div>
              <div />
            </div>
            {filteredItems.map((item, i) => {
              const priceDisplay = resolvePriceDisplay(item.currentPrice ?? undefined);
              const status = resolveStatus(item);
              return (
                <div
                  key={item.id}
                  className={`grid grid-cols-[2.4fr_1fr_1fr_1fr_1fr_0.6fr] items-center gap-4 px-[22px] py-4 hover:bg-[#FAFAFB] ${i < filteredItems.length - 1 ? "border-b border-[#F2F2F5]" : ""}`}
                >
                  <Link href={`/cards/${item.cardId}`} className="flex min-w-0 items-center gap-3">
                    <div className="relative h-14 w-10 flex-shrink-0 overflow-hidden rounded-[7px] bg-[#F2F2F5]">
                      <CardImage src={item.imageUrl ?? undefined} alt={item.cardName ?? undefined} label="카드" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold">{item.cardName ?? "알 수 없는 카드"}</div>
                      <div className="truncate text-xs text-[#9A9AA2]">{item.setName ?? ""}</div>
                    </div>
                  </Link>
                  <div className="text-sm font-bold">
                    {priceDisplay ? toWonSymbol(priceDisplay.price) : "시세 정보 없음"}
                  </div>
                  <div className="text-sm text-[#4B4B52]">{formatTarget(item)}</div>
                  <div>
                    <ChangeRateBadge rate={item.changeRate} />
                  </div>
                  <div>
                    <span
                      className={`rounded-full px-[11px] py-[5px] text-xs font-bold ${STATUS_CLS[status]}`}
                    >
                      {status}
                    </span>
                  </div>
                  <div className="text-right">
                    {confirmDeleteId === item.id ? (
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            disabled={deletingId === item.id}
                            onClick={() => confirmDelete(item.id)}
                            className="rounded-[7px] border-2 border-primary-dark bg-primary px-2 py-1 text-[11px] font-bold text-white disabled:opacity-60"
                          >
                            {deletingId === item.id ? "삭제 중" : "삭제"}
                          </button>
                          <button
                            type="button"
                            onClick={cancelDelete}
                            className="rounded-[7px] border border-[#DDDDE3] px-2 py-1 text-[11px] font-semibold text-[#4B4B52]"
                          >
                            취소
                          </button>
                        </div>
                        {deleteError && (
                          <span className="text-[11px] font-semibold text-primary">{deleteError}</span>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        aria-label="삭제"
                        onClick={() => startDelete(item.id)}
                        className="text-[#C7C7CE] hover:text-primary"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M6 19a2 2 0 002 2h8a2 2 0 002-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
