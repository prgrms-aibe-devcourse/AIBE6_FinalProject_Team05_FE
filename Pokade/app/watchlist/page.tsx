"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AddWatchlistModal from "@/components/AddWatchlistModal";
import CardImage from "@/components/CardImage";
import { useEscapeAndScrollLock } from "@/hooks/useEscapeAndScrollLock";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { ApiError } from "@/lib/apiClient";
import { resolvePriceDisplay } from "@/lib/priceDisplay";
import { deleteWatchlistItem, fetchWatchlist, updateWatchlist } from "@/lib/watchlistApi";
import { WatchlistResponse } from "@/types/watchlist";

// BE에는 targetReached(현재 시점 목표가 범위 진입 여부)만 있고 "확인함"에 대응하는 필드가
// 없어 2단계로 축소. isNotified(알림 발송 이력, 1회성 플래그)와 달리 targetReached는 매 조회
// 시점 실시간 체결가 기준으로 재계산되는 값이라 — 알림이 이미 갔어도 그 뒤 가격이 범위를
// 벗어나면 다시 false가 될 수 있다. 상태 배지는 "지금" 기준을 보여줘야 하므로 이 값을 쓴다.
type Status = "대기중" | "목표도달";
const STATUS_CLS: Record<Status, string> = {
  대기중: "bg-[#FFF3CE] text-[#8A6A00]",
  목표도달: "bg-[#E8F7EF] text-[#087a4e]",
};

type LoadState = "loading" | "error" | "ready";
type Filter = "all" | "wait" | "reached";
type Sort = "oldest" | "latest";

const TABS: { key: Filter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "wait", label: "대기중" },
  { key: "reached", label: "목표도달" },
];

// 현재 BE(findByUserId, OrderBy 없음)가 사실상 등록 오래된순으로 내려주므로 이를 기본값으로 둔다.
// 재정렬은 순수 클라이언트 처리 — 최대 20개(WATCHLIST_LIMIT)라 재요청 없이 바로 정렬 가능.
const SORT_OPTIONS: { key: Sort; label: string }[] = [
  { key: "oldest", label: "등록 오래된순" },
  { key: "latest", label: "등록 최신순" },
];

function statusOf(item: WatchlistResponse): Status {
  return item.targetReached ? "목표도달" : "대기중";
}

// AddWatchlistModal과 동일한 오버레이 패턴(backdrop 클릭/ESC로 닫기, stopPropagation) —
// 이 화면 한 곳에만 쓰이는 확인 모달이라 components/로 공용화하지 않고 로컬로 둔다.
function DeleteConfirmModal({
  cardName,
  submitting,
  onCancel,
  onConfirm,
}: {
  cardName: string;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEscapeAndScrollLock(true, onCancel);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label="관심 목록 삭제 확인"
    >
      <div
        className="w-full max-w-[360px] rounded-2xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="m-0 text-[16px] font-extrabold">관심 목록에서 삭제</h2>
        <p className="mb-5 mt-2 text-[13.5px] leading-relaxed text-[#5A5A62]">
          <b className="font-bold text-ink">{cardName}</b>을(를) 관심 목록에서 삭제하시겠어요?
        </p>
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-[10px] border-[1.5px] border-[#DDDDE3] bg-white py-2.5 text-[13.5px] font-bold text-[#4B4B52] hover:border-primary hover:text-primary"
          >
            취소
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={onConfirm}
            className="flex-1 rounded-[10px] bg-primary py-2.5 text-[13.5px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "삭제 중..." : "삭제"}
          </button>
        </div>
      </div>
    </div>
  );
}

// targetBuyPrice/targetSellPrice 중 최소 하나는 항상 있다(둘 다 없으면 BE가 400).
// 둘 다 등록된 경우 하나만 보여주면 다른 쪽 목표가가 화면에서 사라지므로, 있는 것을 모두 반환한다.
function formatTargets(item: WatchlistResponse): { label: string; value: string }[] {
  const targets: { label: string; value: string }[] = [];
  if (item.targetBuyPrice != null) {
    targets.push({
      label: "목표 구매가",
      value: `${item.targetBuyPrice.toLocaleString("ko-KR")}원`,
    });
  }
  if (item.targetSellPrice != null) {
    targets.push({
      label: "목표 판매가",
      value: `${item.targetSellPrice.toLocaleString("ko-KR")}원`,
    });
  }
  return targets;
}

export default function WatchlistPage() {
  const authStatus = useRequireAuth();

  const [rows, setRows] = useState<WatchlistResponse[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("oldest");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WatchlistResponse | null>(null);
  const [editingItem, setEditingItem] = useState<WatchlistResponse | null>(null);
  const [resendingId, setResendingId] = useState<number | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    let cancelled = false;

    fetchWatchlist()
      .then((items) => {
        if (cancelled) return;
        setRows(items);
        setLoadState("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMessage(err instanceof ApiError ? err.message : "관심 목록 조회에 실패했습니다.");
        setLoadState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  const counts: Record<Filter, number> = {
    all: rows.length,
    wait: rows.filter((r) => !r.targetReached).length,
    reached: rows.filter((r) => r.targetReached).length,
  };

  const filtered = rows.filter((r) => {
    if (filter === "wait") return !r.targetReached;
    if (filter === "reached") return r.targetReached;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return sort === "oldest" ? diff : -diff;
  });

  const tabCls = (active: boolean) =>
    `rounded-[10px] border-[1.5px] px-[15px] py-2 text-[13.5px] cursor-pointer ${
      active
        ? "border-primary bg-[#FFF5F5] font-bold text-primary"
        : "border-[#E4E4E9] bg-white font-semibold text-[#7A7A82]"
    }`;

  // 확인은 DeleteConfirmModal(커스텀 모달)이 담당 — 여기서는 이미 확인된 삭제만 수행한다.
  const handleDelete = async (id: number) => {
    setDeletingId(id);
    setDeleteError(null);
    try {
      await deleteWatchlistItem(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "삭제에 실패했습니다.");
      setDeleteTarget(null);
    } finally {
      setDeletingId(null);
    }
  };

  // PATCH 응답(WatchlistResponse.of)은 cardName/setName/imageUrl/currentPrice/changeRate가
  // 전부 비워져서 온다 — 통째로 교체하면 목록에 이미 표시 중인 시세·등락률 배지가 사라지므로
  // targetBuyPrice/targetSellPrice/isNotified/targetReached만 반영하고 나머지 필드는 기존
  // 값을 유지한다. isNotified를 반영하는 이유: 목표가가 실제로 바뀐 수정에서도 BE가
  // isNotified를 함께 리셋하고, 재알림 요청(resendNotification)에서도 이 값이 false로
  // 바뀌어 오기 때문 — 두 호출부(수정 모달의 onSuccess, 재알림 버튼)가 이 함수를 공유한다.
  // targetReached는 BE #250부터 실제 계산값이 온다(과거엔 항상 false 하드코딩이라 반영해도
  // 의미가 없어 제외했었음) — 이제 반영하지 않으면 목표가 수정 직후 "대기중/목표도달" 배지가
  // 새로고침 전까지 낡은 값으로 남는다.
  const applyWatchlistUpdate = (updated: WatchlistResponse) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === updated.id
          ? {
              ...r,
              targetBuyPrice: updated.targetBuyPrice,
              targetSellPrice: updated.targetSellPrice,
              isNotified: updated.isNotified,
              targetReached: updated.targetReached,
            }
          : r,
      ),
    );
  };

  const handleUpdateSuccess = (updated: WatchlistResponse) => {
    applyWatchlistUpdate(updated);
    setEditingItem(null);
  };

  // 삭제와 달리 되돌리기 쉬운 액션(알림 재수신 상태만 리셋, 목표가/워치리스트 자체는 그대로)이라
  // window.confirm() 없이 바로 실행한다.
  const handleResendNotification = async (id: number) => {
    setResendingId(id);
    setResendError(null);
    try {
      const updated = await updateWatchlist(id, { resendNotification: true });
      applyWatchlistUpdate(updated);
    } catch (err) {
      setResendError(err instanceof ApiError ? err.message : "재알림 설정에 실패했습니다.");
    } finally {
      setResendingId(null);
    }
  };

  if (authStatus !== "authenticated") return null;

  return (
    <main className="main-content bg-neutral px-10 pb-14 pt-9">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-[22px] flex items-end justify-between">
          <div>
            <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.6px]">관심 목록</h1>
            <p className="mt-1.5 text-sm text-[#8A8A92]">
              관심 카드의 목표가 도달 알림을 관리하세요
            </p>
          </div>
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

        {loadState === "ready" && rows.length === 0 && (
          <div className="rounded-2xl border border-[#EDEDF0] bg-white px-10 py-[72px] text-center">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[#F2F2F5]">
              <svg
                width="46"
                height="46"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#C7C7CE"
                strokeWidth="1.6"
                aria-hidden="true"
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

        {loadState === "ready" && rows.length > 0 && (
          <>
            <div className="mb-[18px] flex items-center justify-between">
              <div className="flex gap-2">
                {TABS.map(({ key, label }) => (
                  <button
                    key={key}
                    className={tabCls(filter === key)}
                    onClick={() => setFilter(key)}
                  >
                    {label} {counts[key]}
                  </button>
                ))}
              </div>
              <select
                aria-label="정렬"
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="rounded-[10px] border-[1.5px] border-[#E4E4E9] bg-white px-[15px] py-2 text-[13.5px] font-semibold text-[#7A7A82] outline-none focus:border-primary"
              >
                {SORT_OPTIONS.map(({ key, label }) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {deleteError && (
              <div
                role="alert"
                className="mb-[14px] rounded-[12px] border border-[#F6C6C6] bg-[#FFF1F1] px-4 py-3 text-[13px] font-semibold text-[#C21414]"
              >
                {deleteError}
              </div>
            )}

            {resendError && (
              <div
                role="alert"
                className="mb-[14px] rounded-[12px] border border-[#F6C6C6] bg-[#FFF1F1] px-4 py-3 text-[13px] font-semibold text-[#C21414]"
              >
                {resendError}
              </div>
            )}

            {sorted.length === 0 ? (
              <div className="rounded-2xl border border-[#EDEDF0] bg-white px-6 py-14 text-center text-[13.5px] text-[#8A8A92]">
                해당 상태의 카드가 없습니다.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-[#EDEDF0] bg-white">
                {/* 좁은 화면에서 grid-cols가 찌그러지는 대신 테이블 박스 안에서만 가로 스크롤되도록
                    분리된 스크롤 컨테이너 — min-w는 6개 컬럼이 한 줄로 안 뭉개지는 최소 폭. */}
                <div className="overflow-x-auto">
                  <div className="min-w-[760px]">
                    <div className="grid grid-cols-[2.4fr_1fr_1fr_1fr_1fr_0.6fr] gap-4 border-b border-[#EDEDF0] bg-[#FAFAFB] px-[22px] py-3.5 text-xs font-bold text-[#9A9AA2]">
                      <div>카드</div>
                      <div>현재 시세</div>
                      <div>목표가</div>
                      <div>등락</div>
                      <div>상태</div>
                      <div />
                    </div>
                    {sorted.map((row, i) => {
                      const displayName = row.cardNameKo ?? row.cardName ?? "알 수 없는 카드";
                      const priceLabel =
                        resolvePriceDisplay(row.currentPrice ?? undefined)?.price ?? "정보 없음";
                      const targets = formatTargets(row);
                      const status = statusOf(row);
                      const changeRate = row.changeRate;
                      const isRise = changeRate != null && changeRate >= 0;
                      const changeCls = isRise ? "text-primary" : "text-secondary";
                      return (
                        <div
                          key={row.id}
                          className={`grid grid-cols-[2.4fr_1fr_1fr_1fr_1fr_0.6fr] items-center gap-4 px-[22px] py-4 hover:bg-[#FAFAFB] ${
                            i < sorted.length - 1 ? "border-b border-[#F2F2F5]" : ""
                          }`}
                        >
                          <Link
                            href={`/cards/${row.cardId}`}
                            className="flex items-center gap-3 hover:text-primary"
                          >
                            <div className="relative h-14 w-10 flex-shrink-0 overflow-hidden rounded-[7px] bg-[#F2F2F5]">
                              <CardImage src={row.imageUrl ?? undefined} alt={displayName} />
                            </div>
                            <div>
                              <div className="text-sm font-bold">{displayName}</div>
                              <div className="text-xs text-[#9A9AA2]">{row.setName ?? "-"}</div>
                            </div>
                          </Link>
                          <div className="text-sm font-bold">{priceLabel}</div>
                          <div className="text-sm text-[#4B4B52]">
                            {targets.length > 0 ? (
                              targets.map((t) => (
                                <div key={t.label}>
                                  {t.label}: {t.value}
                                </div>
                              ))
                            ) : (
                              <div>-</div>
                            )}
                          </div>
                          <div
                            className={`text-[13.5px] font-bold ${
                              changeRate != null && changeRate !== 0 ? changeCls : "text-[#9A9AA2]"
                            }`}
                          >
                            {changeRate != null && changeRate !== 0
                              ? `${isRise ? "▲" : "▼"} ${Math.abs(changeRate).toFixed(2)}%`
                              : "-"}
                          </div>
                          <div>
                            <span
                              className={`rounded-full px-[11px] py-[5px] text-xs font-bold ${STATUS_CLS[status]}`}
                            >
                              {status}
                            </span>
                          </div>
                          <div className="flex items-center justify-end gap-3">
                            <button
                              type="button"
                              aria-label={`${displayName} 목표가 수정`}
                              onClick={() => setEditingItem(row)}
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
                            {row.isNotified && (
                              <button
                                type="button"
                                aria-label={`${displayName} 알림 다시 받기`}
                                disabled={resendingId === row.id}
                                onClick={() => handleResendNotification(row.id)}
                                className="-m-3.5 p-3.5 text-[#C7C7CE] hover:text-primary disabled:opacity-50"
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
                                  <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                                  <path d="M13.73 21a2 2 0 01-3.46 0" />
                                </svg>
                              </button>
                            )}
                            <button
                              type="button"
                              aria-label={`${displayName} 관심 목록에서 삭제`}
                              disabled={deletingId === row.id}
                              onClick={() => setDeleteTarget(row)}
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

      {editingItem && (
        <AddWatchlistModal
          isOpen
          onClose={() => setEditingItem(null)}
          mode="edit"
          watchlistId={editingItem.id}
          initialTargetBuyPrice={editingItem.targetBuyPrice}
          initialTargetSellPrice={editingItem.targetSellPrice}
          onSuccess={handleUpdateSuccess}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          cardName={deleteTarget.cardNameKo ?? deleteTarget.cardName ?? "이 카드"}
          submitting={deletingId === deleteTarget.id}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => handleDelete(deleteTarget.id)}
        />
      )}
    </main>
  );
}
