"use client";

import { useEffect, useState } from "react";
import AdminSidebar from "@/components/AdminSidebar";
import { GRADE_BG } from "@/components/GradeBadge";
import { deliverTrade, fetchAdminTrade, fetchPendingTrades, inspectTrade } from "@/lib/adminApi";
import { ApiError } from "@/lib/apiClient";
import { AdminTradeResponse } from "@/types/adminTrade";
import { ListingGrade } from "@/types/price";
import { TradeResponse, TradeStatus } from "@/types/trade";

type LoadState = "loading" | "ready" | "error";

// "yyyy-MM-ddTHH:mm:ss" → "YYYY.MM.DD HH:mm" (다른 화면들과 동일한 표시 규칙).
function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 등급 배지 배경색 — components/GradeBadge.tsx의 GRADE_BG를 단일 소스로 공유
// (app/listings/me/page.tsx의 GradeBadgeInline과 동일한 스타일, 파일별 로컬 정의는 이 코드베이스의 기존 관례).
const GRADE_STYLES: Partial<Record<ListingGrade, string>> = {
  S: `${GRADE_BG.S} text-grade-s-ink`,
  A: `${GRADE_BG.A} text-white`,
  B: `${GRADE_BG.B} text-[#374151]`,
};

function GradeBadgeInline({ grade }: { grade: ListingGrade | null }) {
  if (!grade) return null;
  const style = GRADE_STYLES[grade] ?? "bg-[#EEF0F2] text-[#4B4B52]";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold ${style}`}>
      {grade}
    </span>
  );
}

// trade-status/[id] 페이지의 진행 단계와 동일한 정의 - 거래는 생성 시점에 이미 결제(에스크로)가
// 성립되므로 최소 1단계는 항상 완료 상태다.
const STEPS = [
  { key: "paid", label: "결제 완료" },
  { key: "shipped", label: "판매자 발송" },
  { key: "inspected", label: "검수 완료" },
  { key: "delivered", label: "배송 완료" },
  { key: "confirmed", label: "수령 확정" },
] as const;

function completedStepCount(trade: AdminTradeResponse) {
  let count = 1;
  if (trade.shippedAt) count++;
  if (trade.inspectedAt) count++;
  if (trade.deliveredAt) count++;
  if (trade.confirmedAt) count++;
  return count;
}

function TradeTable({
  title,
  emptyMessage,
  trades,
  actionLabel,
  processingId,
  rowErrors,
  onAction,
  onSelect,
}: {
  title: string;
  emptyMessage: string;
  trades: AdminTradeResponse[];
  actionLabel: string;
  processingId: number | null;
  rowErrors: Record<number, string>;
  onAction: (tradeId: number) => void;
  onSelect: (tradeId: number) => void;
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
          <div className="grid grid-cols-[0.8fr_1.6fr_0.9fr_0.9fr_1fr_1fr] gap-3.5 border-b border-[#EDEDF0] bg-[#FAFAFB] px-[22px] py-[13px] text-xs font-bold text-[#9A9AA2]">
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
              className="grid grid-cols-[0.8fr_1.6fr_0.9fr_0.9fr_1fr_1fr] items-center gap-3.5 border-b border-[#F2F2F5] px-[22px] py-[15px] text-[13.5px] last:border-b-0"
            >
              <button
                type="button"
                onClick={() => onSelect(t.id)}
                className="text-left font-bold text-secondary hover:underline"
              >
                #{t.id}
              </button>
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-[#4B4B52]">
                  {t.cardNameKo ?? t.cardName ?? "알 수 없는 카드"}
                </span>
                <GradeBadgeInline grade={t.grade} />
              </div>
              <div className="truncate text-[#5A5A62]">{t.sellerNickname ?? `#${t.sellerId}`}</div>
              <div className="truncate text-[#5A5A62]">{t.buyerNickname ?? `#${t.buyerId}`}</div>
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

// 거래 번호를 클릭했을 때 뜨는 상세 모달 - 카드/등급/가격/판매자·구매자 닉네임과 현재 진행 상황을 보여준다.
// trade-status/[id] 페이지의 진행 단계 UI를 단순화해 재사용한다.
function TradeDetailModal({
  tradeId,
  onClose,
}: {
  tradeId: number;
  onClose: () => void;
}) {
  const [trade, setTrade] = useState<AdminTradeResponse | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  useEffect(() => {
    let cancelled = false;
    fetchAdminTrade(tradeId)
      .then((res) => {
        if (cancelled) return;
        setTrade(res);
        setLoadState("ready");
      })
      .catch(() => {
        if (!cancelled) setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [tradeId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`거래 #${tradeId} 상세`}
    >
      <div
        className="w-full max-w-[480px] rounded-2xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[16px] font-extrabold">거래 #{tradeId} 상세</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[18px] font-bold text-[#9A9AA2] hover:bg-neutral"
          >
            ×
          </button>
        </div>

        {loadState === "loading" && (
          <div className="py-10 text-center text-[13.5px] text-[#8A8A92]">불러오는 중...</div>
        )}
        {loadState === "error" && (
          <div className="py-10 text-center text-[13.5px] text-[#C21414]">
            거래 상세를 불러오지 못했습니다.
          </div>
        )}
        {loadState === "ready" && trade && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-[14.5px] font-bold">
                {trade.cardNameKo ?? trade.cardName ?? "알 수 없는 카드"}
              </span>
              <GradeBadgeInline grade={trade.grade} />
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
              <dt className="text-[#8A8A92]">가격</dt>
              <dd className="text-right font-bold">{trade.price.toLocaleString("ko-KR")}원</dd>
              <dt className="text-[#8A8A92]">판매자</dt>
              <dd className="text-right font-bold">{trade.sellerNickname ?? `#${trade.sellerId}`}</dd>
              <dt className="text-[#8A8A92]">구매자</dt>
              <dd className="text-right font-bold">{trade.buyerNickname ?? `#${trade.buyerId}`}</dd>
              <dt className="text-[#8A8A92]">받는사람</dt>
              <dd className="text-right font-bold">{trade.recipientName ?? "-"}</dd>
              <dt className="text-[#8A8A92]">접수</dt>
              <dd className="text-right font-bold">{formatDateTime(trade.createdAt)}</dd>
            </dl>

            {trade.status === "CANCELLED" ? (
              <div className="rounded-xl border border-[#F6C6C6] bg-[#FFF1F1] px-4 py-3 text-center text-[13px] font-semibold text-[#C21414]">
                취소된 거래입니다.
              </div>
            ) : (
              <div className="rounded-xl border border-[#EDEDF0] px-4 py-5">
                <div className="flex items-start">
                  {STEPS.map((step, i) => {
                    const doneCount = completedStepCount(trade);
                    const isDone = i < doneCount;
                    const isCurrent = i === doneCount && doneCount < STEPS.length;
                    return (
                      <div key={step.key} className="flex flex-1 items-start last:flex-none">
                        {i > 0 && (
                          <div
                            className={`mt-3.5 h-[2.5px] flex-1 ${i <= doneCount ? "bg-primary" : "bg-[#EDEDF0]"}`}
                          />
                        )}
                        <div className="flex flex-col items-center">
                          <div
                            className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                              isDone
                                ? "bg-primary text-white"
                                : isCurrent
                                  ? "border-2 border-primary text-primary"
                                  : "bg-[#EDEDF0] text-[#B0B0B8]"
                            }`}
                          >
                            {isDone ? "✓" : i + 1}
                          </div>
                          <span
                            className={`mt-1.5 whitespace-nowrap text-[10.5px] font-semibold ${
                              isDone || isCurrent ? "text-ink" : "text-[#B0B0B8]"
                            }`}
                          >
                            {step.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminTradesPage() {
  const [trades, setTrades] = useState<AdminTradeResponse[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const [processingId, setProcessingId] = useState<number | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  // 검수/배송 처리는 되돌리기 어려운 상태 전이라, 버튼 클릭 즉시 실행하지 않고 모달로 한 번 더 확인한다.
  const [confirmTarget, setConfirmTarget] = useState<{
    id: number;
    status: TradeStatus;
    label: string;
  } | null>(null);
  const [detailTradeId, setDetailTradeId] = useState<number | null>(null);

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
              onAction={(id) =>
                setConfirmTarget({ id, status: "SHIPPED_TO_PLATFORM", label: "검수 완료" })
              }
              onSelect={setDetailTradeId}
            />
            <TradeTable
              title="배송 대기"
              emptyMessage="배송 대기 중인 거래가 없습니다."
              trades={awaitingDelivery}
              actionLabel="배송 완료"
              processingId={processingId}
              rowErrors={rowErrors}
              onAction={(id) => setConfirmTarget({ id, status: "INSPECTED", label: "배송 완료" })}
              onSelect={setDetailTradeId}
            />
          </>
        )}
      </div>

      {detailTradeId !== null && (
        <TradeDetailModal tradeId={detailTradeId} onClose={() => setDetailTradeId(null)} />
      )}

      {confirmTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setConfirmTarget(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`${confirmTarget.label} 확인`}
        >
          <div
            className="w-full max-w-[360px] rounded-2xl bg-white p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-2 text-[16px] font-extrabold">{confirmTarget.label} 처리</h2>
            <p className="mb-5 text-[13.5px] text-[#8A8A92]">
              거래 #{confirmTarget.id}를 {confirmTarget.label} 처리하시겠어요? 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmTarget(null)}
                className="flex-1 rounded-[10px] border border-[#DDDDE3] py-2.5 text-[13.5px] font-semibold text-[#4B4B52] hover:border-primary hover:text-primary"
              >
                취소
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = confirmTarget;
                  setConfirmTarget(null);
                  await handleAction(target.id, target.status);
                }}
                className="flex-1 rounded-[10px] border-2 border-primary-dark bg-primary py-2.5 text-[13.5px] font-bold text-white active:translate-y-0.5"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
