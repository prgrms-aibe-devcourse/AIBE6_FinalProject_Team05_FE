"use client";

import { useEffect, useState } from "react";
import AdminSidebar from "@/components/AdminSidebar";
import { deliverTrade, fetchPendingTrades, inspectTrade } from "@/lib/adminApi";
import { ApiError } from "@/lib/apiClient";
import { TradeResponse } from "@/types/trade";

type LoadState = "loading" | "ready" | "error";

// "yyyy-MM-ddTHH:mm:ss" → "YYYY.MM.DD HH:mm" (다른 화면들과 동일한 표시 규칙).
function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function TradeTable({
  title,
  emptyMessage,
  trades,
  actionLabel,
  processingId,
  rowErrors,
  onAction,
}: {
  title: string;
  emptyMessage: string;
  trades: TradeResponse[];
  actionLabel: string;
  processingId: number | null;
  rowErrors: Record<number, string>;
  onAction: (tradeId: number) => void;
}) {
  return (
    <div className="mb-8">
      <h2 className="mb-3 text-[15px] font-extrabold">{title}</h2>
      {trades.length === 0 ? (
        <div className="rounded-[14px] border border-[#EDEDF0] bg-white px-6 py-10 text-center text-[13.5px] text-[#8A8A92]">
          {emptyMessage}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[14px] border border-[#EDEDF0] bg-white">
          <div className="grid grid-cols-[0.8fr_1.4fr_0.9fr_0.9fr_1fr_1fr] gap-3.5 border-b border-[#EDEDF0] bg-[#FAFAFB] px-[22px] py-[13px] text-xs font-bold text-[#9A9AA2]">
            <div>거래번호</div>
            <div>카드</div>
            <div>판매자</div>
            <div>구매자</div>
            <div>접수</div>
            <div>처리</div>
          </div>
          {trades.map((t) => (
            <div
              key={t.id}
              className="grid grid-cols-[0.8fr_1.4fr_0.9fr_0.9fr_1fr_1fr] items-center gap-3.5 border-b border-[#F2F2F5] px-[22px] py-[15px] text-[13.5px] last:border-b-0"
            >
              <div className="font-bold text-secondary">#{t.id}</div>
              <div className="truncate text-[#4B4B52]">{t.cardName ?? "알 수 없는 카드"}</div>
              <div className="text-[#5A5A62]">#{t.sellerId}</div>
              <div className="text-[#5A5A62]">#{t.buyerId}</div>
              <div className="text-[#9A9AA2]">{formatDateTime(t.createdAt)}</div>
              <div>
                <button
                  type="button"
                  disabled={processingId === t.id}
                  onClick={() => onAction(t.id)}
                  className="rounded-[9px] border-[1.5px] border-primary-dark bg-primary px-3 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-60"
                >
                  {processingId === t.id ? "처리 중..." : actionLabel}
                </button>
                {rowErrors[t.id] && (
                  <div className="mt-1 text-[11.5px] font-semibold text-[#C21414]">
                    {rowErrors[t.id]}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminTradesPage() {
  const [trades, setTrades] = useState<TradeResponse[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const [processingId, setProcessingId] = useState<number | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});

  const load = () => {
    setLoadState("loading");
    fetchPendingTrades()
      .then((data) => {
        setTrades(data);
        setLoadState("ready");
      })
      .catch((err) => {
        setErrorMessage(err instanceof ApiError ? err.message : "거래 목록을 불러오지 못했습니다.");
        setLoadState("error");
      });
  };

  useEffect(() => {
    load();
  }, []);

  const handleAction = async (tradeId: number, status: TradeResponse["status"]) => {
    setProcessingId(tradeId);
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[tradeId];
      return next;
    });
    try {
      if (status === "SHIPPED_TO_PLATFORM") {
        await inspectTrade(tradeId);
      } else {
        await deliverTrade(tradeId);
      }
      setTrades((prev) => prev.filter((t) => t.id !== tradeId));
    } catch (err) {
      setRowErrors((prev) => ({
        ...prev,
        [tradeId]: err instanceof ApiError ? err.message : "처리에 실패했습니다.",
      }));
    } finally {
      setProcessingId(null);
    }
  };

  const awaitingInspection = trades.filter((t) => t.status === "SHIPPED_TO_PLATFORM");
  const awaitingDelivery = trades.filter((t) => t.status === "INSPECTED");

  return (
    <main className="main-content flex bg-neutral">
      <AdminSidebar />

      <div className="min-w-0 flex-1 px-9 py-8">
        <h1 className="mb-1 mt-0 text-2xl font-extrabold tracking-[-0.5px]">거래 관리</h1>
        <p className="mb-[22px] text-[13.5px] text-[#8A8A92]">
          발송된 거래를 검수하고 배송 처리합니다
        </p>

        {loadState === "loading" && (
          <div className="rounded-[14px] border border-[#EDEDF0] bg-white px-6 py-14 text-center text-[13.5px] text-[#8A8A92]">
            불러오는 중...
          </div>
        )}

        {loadState === "error" && (
          <div className="rounded-[14px] border border-[#F6C6C6] bg-[#FFF1F1] px-6 py-6 text-center text-[13.5px] text-[#C21414]">
            {errorMessage}
          </div>
        )}

        {loadState === "ready" && (
          <>
            <TradeTable
              title="검수 대기"
              emptyMessage="검수 대기 중인 거래가 없습니다."
              trades={awaitingInspection}
              actionLabel="검수 완료"
              processingId={processingId}
              rowErrors={rowErrors}
              onAction={(id) => handleAction(id, "SHIPPED_TO_PLATFORM")}
            />
            <TradeTable
              title="배송 대기"
              emptyMessage="배송 대기 중인 거래가 없습니다."
              trades={awaitingDelivery}
              actionLabel="배송 완료"
              processingId={processingId}
              rowErrors={rowErrors}
              onAction={(id) => handleAction(id, "INSPECTED")}
            />
          </>
        )}
      </div>
    </main>
  );
}
