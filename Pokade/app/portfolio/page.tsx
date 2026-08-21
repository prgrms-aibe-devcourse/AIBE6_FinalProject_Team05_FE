"use client";

import { useEffect, useState } from "react";
import AddPortfolioItemModal from "@/components/AddPortfolioItemModal";
import CompositionChart from "@/components/portfolio/CompositionChart";
import DexBanner from "@/components/portfolio/DexBanner";
import PortfolioCardGrid from "@/components/portfolio/PortfolioCardGrid";
import PortfolioDetailModal from "@/components/portfolio/PortfolioDetailModal";
import SetCompletionList from "@/components/portfolio/SetCompletionList";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { ApiError } from "@/lib/apiClient";
import {
  deletePortfolioItem,
  fetchPortfolio,
  fetchPortfolioAnalytics,
  fetchPortfolioPnl,
  fetchPortfolioSetCompletion,
  fetchPortfolioSummary,
} from "@/lib/portfolioApi";
import {
  PortfolioAnalyticsResponse,
  PortfolioItemPnlResponse,
  PortfolioItemResponse,
  PortfolioSetCompletionResponse,
  PortfolioSummaryResponse,
} from "@/types/portfolio";

type LoadState = "loading" | "error" | "ready";

export default function PortfolioPage() {
  const authStatus = useRequireAuth();

  const [items, setItems] = useState<PortfolioItemResponse[]>([]);
  const [summary, setSummary] = useState<PortfolioSummaryResponse | null>(null);
  const [analytics, setAnalytics] = useState<PortfolioAnalyticsResponse | null>(null);
  const [setCompletion, setSetCompletion] = useState<PortfolioSetCompletionResponse[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PortfolioItemResponse | null>(null);
  const [selectedItem, setSelectedItem] = useState<PortfolioItemResponse | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [pnlByItemId, setPnlByItemId] = useState<Record<number, PortfolioItemPnlResponse>>({});
  const [pnlErrorByItemId, setPnlErrorByItemId] = useState<Record<number, string>>({});
  const [pnlLoadingId, setPnlLoadingId] = useState<number | null>(null);

  const loadAll = () => {
    setLoadState("loading");
    Promise.all([
      fetchPortfolio(),
      fetchPortfolioSummary(),
      fetchPortfolioAnalytics(),
      fetchPortfolioSetCompletion(),
    ])
      .then(([portfolioItems, summaryResult, analyticsResult, setCompletionResult]) => {
        setItems(portfolioItems);
        setSummary(summaryResult);
        setAnalytics(analyticsResult);
        setSetCompletion(setCompletionResult);
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
    // 총평가액/구성비율/세트 완성도는 새 항목이 반영돼야 하므로 다시 조회한다.
    fetchPortfolioSummary().then(setSummary).catch(() => {});
    fetchPortfolioAnalytics().then(setAnalytics).catch(() => {});
    fetchPortfolioSetCompletion().then(setSetCompletion).catch(() => {});
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
      fetchPortfolioSetCompletion().then(setSetCompletion).catch(() => {});
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

  // 백엔드 요약(summary)은 현재 시세 기준 평가액만 내려주므로, 구매 시점 총액은
  // 보유 항목의 acquiredPrice*quantity를 프론트에서 합산한다(취득가 미입력 항목은 0으로 취급).
  const totalPurchasePrice = items.reduce((sum, it) => sum + (it.acquiredPrice ?? 0) * it.quantity, 0);
  const totalPurchaseLabel = `${totalPurchasePrice.toLocaleString("ko-KR")}원`;
  const totalValueLabel = summary ? `${summary.totalValue.toLocaleString("ko-KR")}원` : "-";

  return (
    <main className="main-content bg-neutral px-10 pb-14 pt-9">
      <div className="mx-auto max-w-[1200px]">
        <DexBanner
          itemCount={items.length}
          totalPurchaseLabel={totalPurchaseLabel}
          totalValueLabel={totalValueLabel}
          summary={summary}
          onAddClick={() => setModalOpen(true)}
        >
          {loadState === "loading" && (
            <div className="px-6 py-14 text-center text-[13.5px] text-[#8A8A92]">불러오는 중...</div>
          )}

          {loadState === "error" && (
            <div role="alert" className="px-6 py-6 text-center text-[13.5px] text-[#C21414]">
              {errorMessage}
            </div>
          )}

          {loadState === "ready" && (
            <>
              {actionError && (
                <div
                  role="alert"
                  className="mb-[14px] rounded border border-[#F6C6C6] bg-[#FFF1F1] px-4 py-3 text-[13px] font-semibold text-[#C21414]"
                >
                  {actionError}
                </div>
              )}

              {/* 왼쪽: 카드 그리드(도감) / 오른쪽: 총 평가액 + 구성 비율 — 리스트와 분석을 좌우로 분리 */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px] lg:items-start">
                <PortfolioCardGrid
                  items={items}
                  onSelect={setSelectedItem}
                  onAddClick={() => setModalOpen(true)}
                />

                <div className="flex flex-col gap-5">
                  <SetCompletionList items={setCompletion} />
                  <CompositionChart title="세트별 구성 비율" data={analytics?.bySet ?? []} />
                  <CompositionChart title="레어도별 구성 비율" data={analytics?.byRarity ?? []} />
                </div>
              </div>
            </>
          )}
        </DexBanner>
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

      {selectedItem && (
        <PortfolioDetailModal
          item={selectedItem}
          pnl={pnlByItemId[selectedItem.id]}
          pnlError={pnlErrorByItemId[selectedItem.id]}
          pnlLoading={pnlLoadingId === selectedItem.id}
          deleting={deletingId === selectedItem.id}
          onClose={() => setSelectedItem(null)}
          onShowPnl={() => handleShowPnl(selectedItem.id)}
          onEdit={() => {
            setEditingItem(selectedItem);
            setSelectedItem(null);
          }}
          onDelete={() => {
            setSelectedItem(null);
            handleDelete(selectedItem.id);
          }}
        />
      )}
    </main>
  );
}
