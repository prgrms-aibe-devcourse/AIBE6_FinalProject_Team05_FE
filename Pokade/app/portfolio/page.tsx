"use client";

import { useEffect, useState } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import AddPortfolioItemModal from "@/components/AddPortfolioItemModal";
import CardImage from "@/components/CardImage";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { ApiError } from "@/lib/apiClient";
import { toKrw } from "@/lib/currency";
import {
  deletePortfolioItem,
  fetchPortfolio,
  fetchPortfolioAnalytics,
  fetchPortfolioPnl,
  fetchPortfolioSummary,
} from "@/lib/portfolioApi";
import { variantLabel } from "@/types/card";
import {
  PortfolioAnalyticsItemResponse,
  PortfolioAnalyticsResponse,
  PortfolioItemPnlResponse,
  PortfolioItemResponse,
  PortfolioSummaryResponse,
} from "@/types/portfolio";

type LoadState = "loading" | "error" | "ready";

// 구성비율 파이차트 색상 — 항목 수가 팔레트보다 많으면 순환한다.
const CHART_COLORS = ["#EE1515", "#3B4CCA", "#FFCB05", "#16A34A", "#8B5CF6", "#F97316", "#9CA3AF"];

// currentMarketPrice/currency는 항목마다 다른 통화(Scrydex 원본 USD 등)로 올 수 있어
// 화면에는 항상 KRW로 환산해서 보여준다(priceDisplay.ts와 동일한 근사 환산 원칙).
function formatKrw(price: number | null, currency: string | null): string {
  if (price == null || currency == null) return "정보 없음";
  const krw = toKrw(price, currency);
  return krw != null ? `${krw.toLocaleString("ko-KR")}원` : "정보 없음";
}

function ChangeBadge({ amount, rate }: { amount: number; rate: number }) {
  if (amount === 0) return <span className="text-[#9A9AA2]">-</span>;
  const isRise = amount > 0;
  return (
    <span className={isRise ? "text-primary" : "text-secondary"}>
      {isRise ? "▲" : "▼"} {Math.abs(amount).toLocaleString("ko-KR")}원 ({Math.abs(rate).toFixed(2)}
      %)
    </span>
  );
}

function CompositionChart({ title, data }: { title: string; data: PortfolioAnalyticsItemResponse[] }) {
  return (
    <div className="flex-1 rounded-2xl border border-[#EDEDF0] bg-white p-5">
      <h3 className="mb-3 text-[14px] font-bold text-[#4B4B52]">{title}</h3>
      {data.length === 0 ? (
        <div className="flex h-[220px] items-center justify-center text-[13px] text-[#9A9AA2]">
          아직 계산할 시세 데이터가 없어요
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              dataKey="ratio"
              nameKey="label"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
            >
              {data.map((entry, i) => (
                <Cell key={entry.label} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => `${Number(value).toFixed(2)}%`} />
            <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default function PortfolioPage() {
  const authStatus = useRequireAuth();

  const [items, setItems] = useState<PortfolioItemResponse[]>([]);
  const [summary, setSummary] = useState<PortfolioSummaryResponse | null>(null);
  const [analytics, setAnalytics] = useState<PortfolioAnalyticsResponse | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PortfolioItemResponse | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [pnlByItemId, setPnlByItemId] = useState<Record<number, PortfolioItemPnlResponse>>({});
  const [pnlErrorByItemId, setPnlErrorByItemId] = useState<Record<number, string>>({});
  const [pnlLoadingId, setPnlLoadingId] = useState<number | null>(null);

  const loadAll = () => {
    setLoadState("loading");
    Promise.all([fetchPortfolio(), fetchPortfolioSummary(), fetchPortfolioAnalytics()])
      .then(([portfolioItems, summaryResult, analyticsResult]) => {
        setItems(portfolioItems);
        setSummary(summaryResult);
        setAnalytics(analyticsResult);
        setLoadState("ready");
      })
      .catch((err) => {
        setErrorMessage(err instanceof ApiError ? err.message : "포트폴리오 조회에 실패했습니다.");
        setLoadState("error");
      });
  };

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    loadAll();
  }, [authStatus]);

  const handleAddSuccess = (created: PortfolioItemResponse) => {
    setItems((prev) => [created, ...prev]);
    // 총평가액/구성비율은 새 항목 시세가 반영돼야 하므로 다시 조회한다.
    fetchPortfolioSummary().then(setSummary).catch(() => {});
    fetchPortfolioAnalytics().then(setAnalytics).catch(() => {});
  };

  const handleUpdateSuccess = (updated: PortfolioItemResponse) => {
    setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
    setEditingItem(null);
    fetchPortfolioSummary().then(setSummary).catch(() => {});
    fetchPortfolioAnalytics().then(setAnalytics).catch(() => {});
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("도감에서 삭제하시겠어요?")) return;
    setDeletingId(id);
    setActionError(null);
    try {
      await deletePortfolioItem(id);
      setItems((prev) => prev.filter((it) => it.id !== id));
      fetchPortfolioSummary().then(setSummary).catch(() => {});
      fetchPortfolioAnalytics().then(setAnalytics).catch(() => {});
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "삭제에 실패했습니다.");
    } finally {
      setDeletingId(null);
    }
  };

  // 항목마다 손익 계산에는 API 호출이 하나씩 필요해서, 목록 조회 시 전부 부르는 대신
  // 사용자가 "손익 보기"를 누른 항목만 조회해 pnlByItemId에 캐싱한다.
  const handleShowPnl = async (id: number) => {
    setPnlLoadingId(id);
    setPnlErrorByItemId((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      const pnl = await fetchPortfolioPnl(id);
      setPnlByItemId((prev) => ({ ...prev, [id]: pnl }));
    } catch (err) {
      setPnlErrorByItemId((prev) => ({
        ...prev,
        [id]: err instanceof ApiError ? err.message : "손익 조회에 실패했습니다.",
      }));
    } finally {
      setPnlLoadingId(null);
    }
  };

  if (authStatus !== "authenticated") return null;

  return (
    <main className="main-content bg-neutral px-10 pb-14 pt-9">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-[22px] flex items-end justify-between">
          <div>
            <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.6px]">내 포트폴리오</h1>
            <p className="mt-1.5 text-sm text-[#8A8A92]">보유 카드 도감과 자산 현황을 확인하세요</p>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="rounded-[11px] border-2 border-primary-dark bg-primary px-[22px] py-2.5 text-[13.5px] font-bold text-white shadow-tactile-sm active:translate-y-0.5"
          >
            카드 추가
          </button>
        </div>

        {loadState === "loading" && (
          <div className="rounded-2xl border border-[#EDEDF0] bg-white px-6 py-14 text-center text-[13.5px] text-[#8A8A92]">
            불러오는 중...
          </div>
        )}

        {loadState === "error" && (
          <div
            role="alert"
            className="rounded-2xl border border-[#F6C6C6] bg-[#FFF1F1] px-6 py-6 text-center text-[13.5px] text-[#C21414]"
          >
            {errorMessage}
          </div>
        )}

        {loadState === "ready" && (
          <>
            {/* 총 평가액 요약 — 토스증권 스타일 */}
            <div className="mb-5 rounded-2xl border border-[#EDEDF0] bg-white px-7 py-6">
              <div className="text-[13px] font-semibold text-[#8A8A92]">총 평가액</div>
              <div className="mt-1.5 text-[30px] font-extrabold tracking-[-0.6px]">
                {summary ? `${summary.totalValue.toLocaleString("ko-KR")}원` : "-"}
              </div>
              {summary && (
                <div className="mt-1.5 text-[13.5px] font-bold">
                  <ChangeBadge amount={summary.changeAmount} rate={summary.changeRate} />
                  <span className="ml-1.5 font-medium text-[#9A9AA2]">전일 대비</span>
                </div>
              )}
            </div>

            {/* 구성 비율 */}
            <div className="mb-5 flex flex-col gap-5 md:flex-row">
              <CompositionChart title="세트별 구성 비율" data={analytics?.bySet ?? []} />
              <CompositionChart title="레어도별 구성 비율" data={analytics?.byRarity ?? []} />
            </div>

            {actionError && (
              <div
                role="alert"
                className="mb-[14px] rounded-[12px] border border-[#F6C6C6] bg-[#FFF1F1] px-4 py-3 text-[13px] font-semibold text-[#C21414]"
              >
                {actionError}
              </div>
            )}

            {items.length === 0 ? (
              <div className="rounded-2xl border border-[#EDEDF0] bg-white px-10 py-[72px] text-center">
                <h3 className="mb-0 text-lg font-extrabold">아직 등록된 카드가 없어요</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-[#8A8A92]">
                  카드를 추가하면 자산 현황과 손익을 한눈에 볼 수 있어요.
                </p>
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="mt-[26px] inline-block rounded-[11px] border-2 border-primary-dark bg-primary px-[26px] py-3 text-[14.5px] font-bold text-white shadow-tactile-sm"
                >
                  카드 추가
                </button>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-[#EDEDF0] bg-white">
                <div className="overflow-x-auto">
                  <div className="min-w-[820px]">
                    <div className="grid grid-cols-[2.2fr_0.6fr_1fr_1fr_1.4fr_0.9fr] gap-4 border-b border-[#EDEDF0] bg-[#FAFAFB] px-[22px] py-3.5 text-xs font-bold text-[#9A9AA2]">
                      <div>카드</div>
                      <div>수량</div>
                      <div>취득가</div>
                      <div>현재 시세</div>
                      <div>손익</div>
                      <div />
                    </div>
                    {items.map((item, i) => {
                      const displayName = item.cardName ?? "알 수 없는 카드";
                      const pnl = pnlByItemId[item.id];
                      const pnlError = pnlErrorByItemId[item.id];
                      return (
                        <div
                          key={item.id}
                          className={`grid grid-cols-[2.2fr_0.6fr_1fr_1fr_1.4fr_0.9fr] items-center gap-4 px-[22px] py-4 hover:bg-[#FAFAFB] ${
                            i < items.length - 1 ? "border-b border-[#F2F2F5]" : ""
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="relative h-14 w-10 flex-shrink-0 overflow-hidden rounded-[7px] bg-[#F2F2F5]">
                              <CardImage src={item.cardImageSmall ?? undefined} alt={displayName} />
                            </div>
                            <div>
                              <div className="text-sm font-bold">{displayName}</div>
                              {item.variantName && (
                                <div className="text-xs text-[#9A9AA2]">
                                  {variantLabel(item.variantName)}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-sm font-semibold">{item.quantity}개</div>
                          <div className="text-sm text-[#4B4B52]">
                            {item.acquiredPrice != null
                              ? `${item.acquiredPrice.toLocaleString("ko-KR")}원`
                              : "-"}
                          </div>
                          <div className="text-sm font-bold">
                            {formatKrw(item.currentMarketPrice, item.currency)}
                          </div>
                          <div className="text-[13px]">
                            {pnl ? (
                              <span className={pnl.pnlAmount >= 0 ? "text-primary" : "text-secondary"}>
                                {pnl.pnlAmount >= 0 ? "+" : ""}
                                {pnl.pnlAmount.toLocaleString("ko-KR")}원 ({pnl.pnlRate.toFixed(2)}%)
                              </span>
                            ) : pnlError ? (
                              <span className="text-[#9A9AA2]">{pnlError}</span>
                            ) : (
                              <button
                                type="button"
                                disabled={pnlLoadingId === item.id}
                                onClick={() => handleShowPnl(item.id)}
                                className="font-semibold text-[#8A8A92] underline decoration-dotted hover:text-primary disabled:opacity-50"
                              >
                                {pnlLoadingId === item.id ? "조회 중..." : "손익 보기"}
                              </button>
                            )}
                          </div>
                          <div className="flex items-center justify-end gap-3">
                            <button
                              type="button"
                              aria-label={`${displayName} 수정`}
                              onClick={() => setEditingItem(item)}
                              className="-m-3.5 p-3.5 text-[#C7C7CE] hover:text-primary"
                            >
                              <svg
                                width="17"
                                height="17"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              aria-label={`${displayName} 삭제`}
                              disabled={deletingId === item.id}
                              onClick={() => handleDelete(item.id)}
                              className="-m-3.5 p-3.5 text-[#C7C7CE] hover:text-primary disabled:opacity-50"
                            >
                              <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                aria-hidden="true"
                              >
                                <path d="M6 19a2 2 0 002 2h8a2 2 0 002-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <AddPortfolioItemModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleAddSuccess}
      />

      {editingItem && (
        <AddPortfolioItemModal
          isOpen
          onClose={() => setEditingItem(null)}
          mode="edit"
          item={editingItem}
          onSuccess={handleUpdateSuccess}
        />
      )}
    </main>
  );
}
