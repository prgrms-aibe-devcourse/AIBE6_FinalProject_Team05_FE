"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import CardImage from "@/components/CardImage";
import { GRADE_BG } from "@/components/GradeBadge";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useUserStore } from "@/store/useUserStore";
import { ApiError } from "@/lib/apiClient";
import { cancelTrade, confirmTrade, fetchTrade, shipTrade } from "@/lib/tradeApi";
import { ListingGrade } from "@/types/price";
import { parseTradeId, TradeResponse } from "@/types/trade";

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

// DELIVERED(실물 수령) 이후와 COMPLETED/CANCELLED(종결 상태)는 취소할 수 없다 — BE의 cancel() 가드와
// 동일하게. 배송 완료 후에도 취소를 허용하면 카드를 받고도 결제를 환불받아가는 경로가 생긴다.
const CANCELLABLE = new Set(["PENDING", "SHIPPED_TO_PLATFORM", "INSPECTED"]);

// 실제 택배사 추적 연동이 없어 확정 도착일이 아닌, 운영 기준(발송 후 24시간 이내 검수 /
// 검수 후 2일 이내 배송)으로 계산한 참고용 예상치다.
const INSPECTION_SLA_HOURS = 24;
const DELIVERY_SLA_DAYS = 2;

// 즉시구매 결제 시 상품가에 더해지는 고정 배송비 — BE(TradeService.SHIPPING_FEE)와 동일한 값.
// Trade/Payment 어디에도 배송비 자체가 저장되지 않고 결제 금액에만 반영되므로, 여기서도 상수로 둔다.
const SHIPPING_FEE = 3000;

const STEPS = [
  { key: "paid", label: "결제 완료" },
  { key: "shipped", label: "판매자 발송" },
  { key: "inspected", label: "검수 완료" },
  { key: "delivered", label: "배송 완료" },
  { key: "confirmed", label: "수령 확정" },
] as const;

// 현재까지 완료된 스텝 개수 — 거래는 생성 시점에 이미 결제(에스크로)가 성립되므로 최소 1.
function completedStepCount(trade: TradeResponse) {
  let count = 1;
  if (trade.shippedAt) count++;
  if (trade.inspectedAt) count++;
  if (trade.deliveredAt) count++;
  if (trade.confirmedAt) count++;
  return count;
}

// "yyyy-MM-ddTHH:mm:ss" → "YYYY.MM.DD HH:mm" (app/cards/[id]/page.tsx의 formatTradedAt과 동일 규칙).
function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 발송 시각 기준 검수 완료 예상 안내 — 실제 SLA 추적이 없어 고정 기준(24시간)으로 계산한 참고용 문구.
function inspectionEtaText(shippedAt: string) {
  const target = new Date(shippedAt);
  target.setHours(target.getHours() + INSPECTION_SLA_HOURS);
  const remainingHours = Math.ceil((target.getTime() - Date.now()) / (1000 * 60 * 60));
  if (remainingHours <= 0) {
    return "검수 완료 예정 시간이 지났습니다. 곧 처리될 예정입니다.";
  }
  return `약 ${remainingHours}시간 후 검수 완료 예정 (${formatDateTime(target.toISOString())})`;
}

// 검수 완료 시각 기준 배송 완료 예상 안내 — 고정 기준(2일)으로 계산한 참고용 문구.
function deliveryEtaText(inspectedAt: string) {
  const target = new Date(inspectedAt);
  target.setDate(target.getDate() + DELIVERY_SLA_DAYS);
  const remainingDays = Math.ceil((target.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (remainingDays <= 0) {
    return "도착 예정일이 지났습니다. 곧 도착할 예정입니다.";
  }
  return `약 ${remainingDays}일 후 도착 예정 (${formatDateTime(target.toISOString())})`;
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
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const [retryKey, setRetryKey] = useState(0);

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
  }, [userStatus, tradeId, retryKey]);

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
      setConfirmingCancel(false);
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
          <div className="flex flex-col gap-5">
            <div className="h-[70px] animate-pulse rounded-2xl border border-[#EDEDF0] bg-[#F2F2F5]" />
            <div className="h-[92px] animate-pulse rounded-2xl border border-[#EDEDF0] bg-[#F2F2F5]" />
            <div className="rounded-2xl border border-[#EDEDF0] bg-white p-6">
              <div className="flex gap-4">
                <div className="h-[100px] w-[72px] flex-shrink-0 animate-pulse rounded-[10px] bg-[#F2F2F5]" />
                <div className="flex-1 space-y-2.5 pt-1">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-[#F2F2F5]" />
                  <div className="h-6 w-1/3 animate-pulse rounded bg-[#F2F2F5]" />
                </div>
              </div>
              <div className="my-5 h-px bg-[#EDEDF0]" />
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-4 animate-pulse rounded bg-[#F2F2F5]" />
                ))}
              </div>
            </div>
          </div>
        )}

        {loadState === "notfound" && (
          <div className="rounded-2xl border border-[#EDEDF0] bg-white py-14 text-center text-[13.5px] text-[#9A9AA2]">
            <p>거래를 찾을 수 없습니다.</p>
            <Link
              href="/listings/me"
              className="mt-3 inline-block text-[12.5px] font-bold text-primary hover:text-primary-dark"
            >
              내 상품으로 돌아가기
            </Link>
          </div>
        )}

        {loadState === "forbidden" && (
          <div className="rounded-2xl border border-[#EDEDF0] bg-white py-14 text-center text-[13.5px] text-[#9A9AA2]">
            <p>본인의 거래만 확인할 수 있습니다.</p>
            <Link
              href="/listings/me"
              className="mt-3 inline-block text-[12.5px] font-bold text-primary hover:text-primary-dark"
            >
              내 상품으로 돌아가기
            </Link>
          </div>
        )}

        {loadState === "error" && (
          <div className="rounded-2xl border border-[#F6C6C6] bg-[#FFF1F1] py-14 text-center text-[13.5px] text-[#C21414]">
            <p>거래 정보를 불러오지 못했습니다.</p>
            <button
              type="button"
              onClick={() => {
                setLoadState("loading");
                setRetryKey((k) => k + 1);
              }}
              className="mt-3 font-bold text-[#C21414] underline hover:no-underline"
            >
              다시 시도
            </button>
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
                <p>플랫폼에서 매물을 검수 중입니다.</p>
                {trade.shippedAt && (
                  <p className="mt-1 text-[12px] font-semibold text-[#9A7B1F]">
                    {inspectionEtaText(trade.shippedAt)}
                  </p>
                )}
              </div>
            )}
            {trade.status === "INSPECTED" && (
              <div className="rounded-2xl border border-[#F5E4A8] bg-[#FFF9E6] px-5 py-4 text-[13.5px] font-semibold text-[#8A6A00]">
                <p>검수가 완료되어 배송 준비 중입니다.</p>
                {trade.inspectedAt && (
                  <p className="mt-1 text-[12px] font-semibold text-[#9A7B1F]">
                    {deliveryEtaText(trade.inspectedAt)}
                  </p>
                )}
              </div>
            )}
            {trade.status === "DELIVERED" && (
              <div className="rounded-2xl border border-[#F5E4A8] bg-[#FFF9E6] px-5 py-4 text-[13.5px] font-semibold text-[#8A6A00]">
                {isBuyer
                  ? "배송이 완료되었습니다. 수령 후 구매를 확정해 주세요."
                  : "구매자의 확정을 기다리는 중입니다."}
              </div>
            )}

            {/* 진행 단계 — 연결선을 원(circle+label) 컬럼 밖, 컬럼 사이에 별도로 두어야
                각 단계의 체크 아이콘과 라벨이 항상 같은 중심선에서 정렬된다. 연결선을 컬럼 안에
                같이 넣으면 선이 flex-1로 늘어나면서 아이콘이 컬럼 중심이 아니라 한쪽으로 밀려
                라벨(가운데 정렬)과 어긋나 보인다. */}
            {trade.status !== "CANCELLED" && (
              <div className="rounded-2xl border border-[#EDEDF0] bg-white px-6 py-7">
                <div className="flex items-start">
                  {STEPS.map((step, i) => {
                    const doneCount = completedStepCount(trade);
                    const isDone = i < doneCount;
                    const isCurrent = i === doneCount && doneCount < STEPS.length;
                    return (
                      <Fragment key={step.key}>
                        {i > 0 && (
                          <div
                            className={`mt-4 h-[3px] flex-1 ${i <= doneCount ? "bg-primary" : "bg-[#EDEDF0]"}`}
                          />
                        )}
                        <div className="flex flex-col items-center">
                          <div
                            className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${
                              isDone
                                ? "bg-primary text-white"
                                : isCurrent
                                  ? "border-2 border-primary bg-white text-primary"
                                  : "border border-[#DDDDE3] bg-white text-[#B0B0B8]"
                            }`}
                          >
                            {isDone ? "✓" : i + 1}
                          </div>
                          <span
                            className={`mt-2 whitespace-nowrap text-center text-[11.5px] font-semibold ${
                              isDone || isCurrent ? "text-ink" : "text-[#B0B0B8]"
                            }`}
                          >
                            {step.label}
                          </span>
                        </div>
                      </Fragment>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 거래 카드 정보 */}
            <div className="rounded-2xl border border-[#EDEDF0] bg-white p-6">
              <div className="flex gap-4">
                <div className="relative h-[100px] w-[72px] flex-shrink-0 overflow-hidden rounded-[10px] bg-[#F2F2F5]">
                  <CardImage
                    src={trade.cardImageUrl ?? undefined}
                    alt={trade.cardNameKo ?? trade.cardName ?? "카드"}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/cards/${trade.cardId}`}
                      className="text-[15.5px] font-extrabold hover:text-primary"
                    >
                      {trade.cardNameKo ?? trade.cardName ?? "알 수 없는 카드"}
                    </Link>
                    <GradeBadgeInline grade={trade.grade} />
                  </div>
                  <div className="mt-3.5 text-xs text-[#9A9AA2]">상품 금액</div>
                  <div className="text-xl font-extrabold text-primary">
                    {trade.price.toLocaleString("ko-KR")}원
                  </div>
                </div>
              </div>
              <div className="my-5 h-px bg-[#EDEDF0]" />
              <div className="flex flex-col gap-[11px] text-[13.5px]">
                <div className="flex justify-between">
                  <span className="text-[#8A8A92]">배송비</span>
                  <span className="font-bold">{SHIPPING_FEE.toLocaleString("ko-KR")}원</span>
                </div>
                {!!trade.pointsUsed && (
                  <div className="flex justify-between">
                    <span className="text-[#8A8A92]">포인트 사용</span>
                    <span className="font-bold">-{trade.pointsUsed.toLocaleString("ko-KR")}P</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-[#8A8A92]">총 결제 금액</span>
                  <span className="font-bold">
                    {(trade.price + SHIPPING_FEE - (trade.pointsUsed ?? 0)).toLocaleString("ko-KR")}원
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A8A92]">거래 번호</span>
                  <span className="font-bold">#{trade.id}</span>
                </div>
                {/* userId 복원이 실패로 끝나면(authenticated + userIdRestoring=false + userId=null)
                    isBuyer가 false로 떨어져 실제 구매자에게 자기 자신을 상대방으로 안내하게 된다.
                    userId를 신뢰할 수 있을 때만 상대방 줄을 노출한다. */}
                {userId != null && (
                  <div className="flex justify-between">
                    <span className="text-[#8A8A92]">{isBuyer ? "판매자" : "구매자"}</span>
                    <Link
                      href={`/users/${isBuyer ? trade.sellerId : trade.buyerId}`}
                      className="font-bold hover:text-primary"
                    >
                      프로필 보기
                      <span aria-hidden="true" className="ml-1 text-[#B0B0B8]">
                        ›
                      </span>
                    </Link>
                  </div>
                )}
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
                {trade.settledAt && (
                  <div className="flex justify-between">
                    <span className="text-[#8A8A92]">정산일</span>
                    <span className="font-bold">{formatDateTime(trade.settledAt)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 배송지 정보 — 판매자가 발송할 때 필요하고, 구매자도 본인이 입력한 정보를 확인할 수 있다. */}
            {trade.recipientName && (
              <div className="rounded-2xl border border-[#EDEDF0] bg-white p-6">
                <h2 className="mb-3.5 text-[13px] font-bold text-[#4B4B52]">배송지 정보</h2>
                <div className="flex flex-col gap-[11px] text-[13.5px]">
                  <div className="flex justify-between">
                    <span className="text-[#8A8A92]">받는 사람</span>
                    <span className="font-bold">{trade.recipientName}</span>
                  </div>
                  {trade.recipientPhone && (
                    <div className="flex justify-between">
                      <span className="text-[#8A8A92]">연락처</span>
                      <span className="font-bold">{trade.recipientPhone}</span>
                    </div>
                  )}
                  {trade.recipientAddress && (
                    <div className="flex justify-between gap-3">
                      <span className="flex-shrink-0 text-[#8A8A92]">주소</span>
                      <span className="text-right font-bold">{trade.recipientAddress}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {actionError && (
              <div className="rounded-2xl border border-[#F6C6C6] bg-[#FFF1F1] px-5 py-3 text-[13px] font-semibold text-[#C21414]">
                {actionError}
              </div>
            )}

            {(cancellable ||
              (isSeller && trade.status === "PENDING") ||
              (isBuyer && trade.status === "DELIVERED")) && (
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
                {/* 구매 확정은 DELIVERED에서만 가능한데, DELIVERED는 더 이상 취소 가능 상태가 아니라서
                    (CANCELLABLE 참고) cancellable 여부와 무관하게 독립적으로 노출해야 한다. */}
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
                {cancellable &&
                  (confirmingCancel ? (
                    <div className="flex items-center gap-2 rounded-xl border-[1.5px] border-[#F6C6C6] bg-[#FFF1F1] px-4 py-3">
                      <span className="flex-1 text-[13px] font-semibold text-[#C21414]">
                        정말 거래를 취소하시겠어요?
                      </span>
                      <button
                        type="button"
                        disabled={actionSubmitting}
                        onClick={handleCancel}
                        className="rounded-[9px] border-2 border-primary-dark bg-primary px-3 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-60"
                      >
                        {actionSubmitting ? "취소 중..." : "취소하기"}
                      </button>
                      <button
                        type="button"
                        disabled={actionSubmitting}
                        onClick={() => setConfirmingCancel(false)}
                        className="rounded-[9px] border border-[#DDDDE3] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#4B4B52]"
                      >
                        돌아가기
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={actionSubmitting}
                      onClick={() => setConfirmingCancel(true)}
                      className="w-full rounded-xl border-[1.5px] border-[#DDDDE3] bg-white py-[15px] text-[15px] font-bold text-[#4B4B52] hover:border-primary hover:text-primary disabled:opacity-60"
                    >
                      거래 취소
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
