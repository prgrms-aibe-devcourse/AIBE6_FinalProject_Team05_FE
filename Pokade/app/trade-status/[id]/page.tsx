"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import CardImage from "@/components/CardImage";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useUserStore } from "@/store/useUserStore";
import { ApiError } from "@/lib/apiClient";
import { cancelTrade, confirmTrade, fetchTrade, shipTrade } from "@/lib/tradeApi";
import { parseTradeId, TradeResponse } from "@/types/trade";

// COMPLETED/CANCELLED(종결 상태)를 제외한 나머지는 전부 취소 가능 — BE의 cancel() 가드와 동일하게.
const CANCELLABLE = new Set(["PENDING", "SHIPPED_TO_PLATFORM", "INSPECTED", "DELIVERED"]);

// "yyyy-MM-ddTHH:mm:ss" → "YYYY.MM.DD HH:mm" (app/cards/[id]/page.tsx의 formatTradedAt과 동일 규칙).
function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type LoadState = "loading" | "notfound" | "forbidden" | "error" | "ready";

export default function TradeStatusPage() {
  const { id } = useParams<{ id: string }>();
  const tradeId = parseTradeId(id);
  const userStatus = useRequireAuth();
  const userId = useUserStore((s) => s.userId);
  const userIdRestoring = useUserStore((s) => s.userIdRestoring);

  const [trade, setTrade] = useState<TradeResponse | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (userStatus !== "authenticated" || tradeId == null) return;
    let cancelled = false;
    fetchTrade(tradeId)
      .then((data) => {
        if (!cancelled) {
          setTrade(data);
          setLoadState("ready");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setLoadState("notfound");
        } else if (err instanceof ApiError && err.status === 403) {
          setLoadState("forbidden");
        } else {
          setLoadState("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userStatus, tradeId]);

  const handleShip = async () => {
    if (!trade) return;
    setActionSubmitting(true);
    setActionError(null);
    try {
      const updated = await shipTrade(trade.id);
      setTrade(updated);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "발송 처리에 실패했습니다.");
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleConfirm = async () => {
    if (!trade) return;
    setActionSubmitting(true);
    setActionError(null);
    try {
      const updated = await confirmTrade(trade.id);
      setTrade(updated);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "거래 확정에 실패했습니다.");
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!trade) return;
    setActionSubmitting(true);
    setActionError(null);
    try {
      const updated = await cancelTrade(trade.id);
      setTrade(updated);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "거래 취소에 실패했습니다.");
    } finally {
      setActionSubmitting(false);
    }
  };

  if (userStatus !== "authenticated") return null;

  if (tradeId == null) {
    return (
      <main className="main-content flex items-center justify-center bg-neutral px-10 py-14">
        <div className="text-[13.5px] text-[#9A9AA2]">잘못된 거래 번호입니다.</div>
      </main>
    );
  }

  // userId 복원이 끝나기 전에는 구매자 판정을 내리지 않는다 — 안 그러면 실제 구매자도
  // 일시적으로 "구매 확정" 버튼이 안 보이는 것처럼 보일 수 있다.
  if (userIdRestoring) {
    return (
      <main className="main-content flex items-center justify-center bg-neutral px-10 py-14">
        <div className="text-[13.5px] text-[#9A9AA2]">인증 확인 중...</div>
      </main>
    );
  }

  const isBuyer = trade != null && userId != null && trade.buyerId === userId;
  const isSeller = trade != null && userId != null && trade.sellerId === userId;
  const cancellable = trade != null && CANCELLABLE.has(trade.status);

  return (
    <main className="main-content bg-neutral px-10 pb-14 pt-9">
      <div className="mx-auto max-w-[640px]">
        <h1 className="mb-6 text-[26px] font-extrabold tracking-[-0.6px]">거래 상세</h1>

        {loadState === "loading" && (
          <div className="rounded-2xl border border-[#EDEDF0] bg-white py-14 text-center text-[13.5px] text-[#9A9AA2]">
            불러오는 중...
          </div>
        )}

        {loadState === "notfound" && (
          <div className="rounded-2xl border border-[#EDEDF0] bg-white py-14 text-center text-[13.5px] text-[#9A9AA2]">
            거래를 찾을 수 없습니다.
          </div>
        )}

        {loadState === "forbidden" && (
          <div className="rounded-2xl border border-[#EDEDF0] bg-white py-14 text-center text-[13.5px] text-[#9A9AA2]">
            본인의 거래만 확인할 수 있습니다.
          </div>
        )}

        {loadState === "error" && (
          <div className="rounded-2xl border border-[#F6C6C6] bg-[#FFF1F1] py-14 text-center text-[13.5px] text-[#C21414]">
            거래 정보를 불러오지 못했습니다.
          </div>
        )}

        {loadState === "ready" && trade && (
          <div className="flex flex-col gap-5">
            {/* 상태 배너 */}
            {trade.status === "COMPLETED" && (
              <div className="rounded-2xl border border-[#BEE7CE] bg-[#E8F7EF] px-5 py-4 text-[13.5px] font-semibold text-[#059669]">
                거래가 완료되었습니다.
              </div>
            )}
            {trade.status === "CANCELLED" && (
              <div className="rounded-2xl border border-[#EDEDF0] bg-white px-5 py-4 text-[13.5px] font-semibold text-[#9A9AA2]">
                취소된 거래입니다.
              </div>
            )}
            {trade.status === "PENDING" && (
              <div className="rounded-2xl border border-[#F5E4A8] bg-[#FFF9E6] px-5 py-4 text-[13.5px] font-semibold text-[#8A6A00]">
                {isSeller
                  ? "구매가 접수되었습니다. 플랫폼으로 발송해 주세요."
                  : "판매자의 발송을 기다리는 중입니다."}
              </div>
            )}
            {trade.status === "SHIPPED_TO_PLATFORM" && (
              <div className="rounded-2xl border border-[#F5E4A8] bg-[#FFF9E6] px-5 py-4 text-[13.5px] font-semibold text-[#8A6A00]">
                플랫폼에서 매물을 검수 중입니다.
              </div>
            )}
            {trade.status === "INSPECTED" && (
              <div className="rounded-2xl border border-[#F5E4A8] bg-[#FFF9E6] px-5 py-4 text-[13.5px] font-semibold text-[#8A6A00]">
                검수가 완료되어 배송 준비 중입니다.
              </div>
            )}
            {trade.status === "DELIVERED" && (
              <div className="rounded-2xl border border-[#F5E4A8] bg-[#FFF9E6] px-5 py-4 text-[13.5px] font-semibold text-[#8A6A00]">
                {isBuyer
                  ? "배송이 완료되었습니다. 수령 후 구매를 확정해 주세요."
                  : "구매자의 확정을 기다리는 중입니다."}
              </div>
            )}

            {/* 거래 카드 정보 */}
            <div className="rounded-2xl border border-[#EDEDF0] bg-white p-6">
              <div className="flex gap-4">
                <div className="relative h-[100px] w-[72px] flex-shrink-0 overflow-hidden rounded-[10px] bg-[#F2F2F5]">
                  <CardImage alt={trade.cardName ?? "카드"} />
                </div>
                <div className="flex-1">
                  <Link
                    href={`/cards/${trade.cardId}`}
                    className="text-[15.5px] font-extrabold hover:text-primary"
                  >
                    {trade.cardName ?? "알 수 없는 카드"}
                  </Link>
                  <div className="mt-3.5 text-xs text-[#9A9AA2]">결제 금액</div>
                  <div className="text-xl font-extrabold text-primary">
                    {trade.price.toLocaleString("ko-KR")}원
                  </div>
                </div>
              </div>
              <div className="my-5 h-px bg-[#EDEDF0]" />
              <div className="flex flex-col gap-[11px] text-[13.5px]">
                <div className="flex justify-between">
                  <span className="text-[#8A8A92]">거래 번호</span>
                  <span className="font-bold">#{trade.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A8A92]">거래 요청일</span>
                  <span className="font-bold">{formatDateTime(trade.createdAt)}</span>
                </div>
                {trade.shippedAt && (
                  <div className="flex justify-between">
                    <span className="text-[#8A8A92]">발송일</span>
                    <span className="font-bold">{formatDateTime(trade.shippedAt)}</span>
                  </div>
                )}
                {trade.inspectedAt && (
                  <div className="flex justify-between">
                    <span className="text-[#8A8A92]">검수완료일</span>
                    <span className="font-bold">{formatDateTime(trade.inspectedAt)}</span>
                  </div>
                )}
                {trade.deliveredAt && (
                  <div className="flex justify-between">
                    <span className="text-[#8A8A92]">배송완료일</span>
                    <span className="font-bold">{formatDateTime(trade.deliveredAt)}</span>
                  </div>
                )}
                {trade.confirmedAt && (
                  <div className="flex justify-between">
                    <span className="text-[#8A8A92]">확정일</span>
                    <span className="font-bold">{formatDateTime(trade.confirmedAt)}</span>
                  </div>
                )}
              </div>
            </div>

            {actionError && (
              <div className="rounded-2xl border border-[#F6C6C6] bg-[#FFF1F1] px-5 py-3 text-[13px] font-semibold text-[#C21414]">
                {actionError}
              </div>
            )}

            {cancellable && (
              <div className="flex flex-col gap-[11px]">
                {isSeller && trade.status === "PENDING" && (
                  <button
                    type="button"
                    disabled={actionSubmitting}
                    onClick={handleShip}
                    className="w-full rounded-xl border-2 border-primary-dark bg-primary py-[15px] text-[15.5px] font-bold text-white shadow-tactile transition active:translate-y-0.5 active:shadow-tactile-active disabled:opacity-60"
                  >
                    {actionSubmitting ? "처리 중..." : "발송하기"}
                  </button>
                )}
                {isBuyer && trade.status === "DELIVERED" && (
                  <button
                    type="button"
                    disabled={actionSubmitting}
                    onClick={handleConfirm}
                    className="w-full rounded-xl border-2 border-primary-dark bg-primary py-[15px] text-[15.5px] font-bold text-white shadow-tactile transition active:translate-y-0.5 active:shadow-tactile-active disabled:opacity-60"
                  >
                    {actionSubmitting ? "처리 중..." : "구매 확정"}
                  </button>
                )}
                <button
                  type="button"
                  disabled={actionSubmitting}
                  onClick={handleCancel}
                  className="w-full rounded-xl border-[1.5px] border-[#DDDDE3] bg-white py-[15px] text-[15px] font-bold text-[#4B4B52] hover:border-primary hover:text-primary disabled:opacity-60"
                >
                  거래 취소
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
