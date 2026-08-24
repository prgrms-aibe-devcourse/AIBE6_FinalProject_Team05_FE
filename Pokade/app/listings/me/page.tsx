"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GRADE_BG } from "@/components/GradeBadge";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { ApiError, PageResponse } from "@/lib/apiClient";
import { deleteListing, fetchMyListings, MyListingsSort, updateListing } from "@/lib/listingApi";
import { ListingGrade, ListingStatus, ListingSummaryResponse } from "@/types/price";

const PAGE_SIZE = 10;

const SORT_OPTIONS: { key: MyListingsSort; label: string }[] = [
  { key: "createdAt,desc", label: "등록 최신순" },
  { key: "createdAt,asc", label: "등록 오래된순" },
  { key: "price,asc", label: "가격 낮은순" },
  { key: "price,desc", label: "가격 높은순" },
];

const STATUS_FILTERS: { label: string; value: ListingStatus | null }[] = [
  { label: "전체", value: null },
  { label: "판매중", value: "ACTIVE" },
  { label: "거래중", value: "TRADING" },
  { label: "판매완료", value: "SOLD" },
  { label: "기간만료", value: "EXPIRED" },
  { label: "취소됨", value: "CANCELLED" },
  { label: "숨김", value: "HIDDEN" },
];

// 등급 배지 배경색 — components/GradeBadge.tsx의 GRADE_BG를 단일 소스로 공유 (텍스트색은 배지 형태가 달라 여기서만 정의).
const GRADE_STYLES: Partial<Record<ListingGrade, string>> = {
  S: `${GRADE_BG.S} text-grade-s-ink`,
  A: `${GRADE_BG.A} text-white`,
  B: `${GRADE_BG.B} text-[#374151]`,
};

function GradeBadgeInline({ grade }: { grade: ListingGrade | null }) {
  const style = grade ? (GRADE_STYLES[grade] ?? "bg-[#EEF0F2] text-[#4B4B52]") : null;
  if (!grade) return null;
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold ${style}`}>
      {grade}
    </span>
  );
}

const STATUS_STYLES: Record<ListingStatus, string> = {
  ACTIVE: "bg-[#E8F7EF] text-[#059669]",
  TRADING: "bg-lavender text-secondary",
  SOLD: "bg-[#EEF0F2] text-[#4B4B52]",
  EXPIRED: "bg-[#EEF0F2] text-[#9A9AA2]",
  CANCELLED: "bg-[#EEF0F2] text-[#9A9AA2]",
  HIDDEN: "bg-[#EEF0F2] text-[#9A9AA2]",
};

const STATUS_LABELS: Record<ListingStatus, string> = {
  ACTIVE: "판매중",
  TRADING: "거래중",
  SOLD: "판매완료",
  EXPIRED: "기간만료",
  CANCELLED: "취소됨",
  HIDDEN: "숨김",
};

function StatusBadge({ status }: { status: ListingStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-[12px] font-bold ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

// "yyyy-MM-ddTHH:mm:ss" → "YYYY.MM.DD" 표시 (app/cards/[id]/page.tsx의 formatTradedAt과 동일 규칙).
function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

type LoadState = "loading" | "error" | "ready";

export default function MyListingsPage() {
  const status = useRequireAuth();

  const [statusFilter, setStatusFilter] = useState<ListingStatus | null>(null);
  const [sort, setSort] = useState<MyListingsSort>("createdAt,desc");
  const [page, setPage] = useState(0);
  const [pageData, setPageData] = useState<PageResponse<ListingSummaryResponse> | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  // 가격 수정
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // 삭제(2단계 확인)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // 상태/정렬 변경 시 페이지를 0으로 되돌리고 다시 조회 — 서버 페이징이라 필터·정렬이 바뀌면 항상 재요청이 필요하다.
  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    fetchMyListings(statusFilter ?? undefined, page, PAGE_SIZE, sort)
      .then((data) => {
        if (!cancelled) {
          setPageData(data);
          setLoadState("ready");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setErrorMessage(err instanceof ApiError ? err.message : "상품 조회에 실패했습니다.");
          setLoadState("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [status, statusFilter, sort, page]);

  const listings = pageData?.content ?? [];

  const startEdit = (listing: ListingSummaryResponse) => {
    setConfirmDeleteId(null);
    setEditingId(listing.id);
    setEditPrice(String(listing.price));
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError(null);
  };

  const submitEdit = async (listingId: number) => {
    const priceNumber = Number(editPrice);
    if (!editPrice || !Number.isInteger(priceNumber) || priceNumber <= 0) {
      setEditError("가격을 올바르게 입력해 주세요.");
      return;
    }
    setEditSubmitting(true);
    setEditError(null);
    try {
      const updated = await updateListing(listingId, { price: priceNumber });
      setPageData((prev) =>
        prev
          ? {
              ...prev,
              content: prev.content.map((l) =>
                l.id === listingId ? { ...l, price: updated.price } : l,
              ),
            }
          : prev,
      );
      setEditingId(null);
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "가격 수정에 실패했습니다.");
    } finally {
      setEditSubmitting(false);
    }
  };

  const startDelete = (listingId: number) => {
    setEditingId(null);
    setConfirmDeleteId(listingId);
    setDeleteError(null);
  };

  const cancelDelete = () => {
    setConfirmDeleteId(null);
    setDeleteError(null);
  };

  const confirmDelete = async (listingId: number) => {
    setDeleteSubmitting(true);
    setDeleteError(null);
    try {
      await deleteListing(listingId);
      setPageData((prev) =>
        prev
          ? {
              ...prev,
              content: prev.content.map((l) =>
                l.id === listingId ? { ...l, status: "CANCELLED" } : l,
              ),
            }
          : prev,
      );
      setConfirmDeleteId(null);
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "상품 삭제에 실패했습니다.");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  if (status !== "authenticated") return null;

  return (
    <main className="main-content bg-neutral px-10 py-14">
      <div className="mx-auto w-full max-w-[860px]">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-[22px] font-extrabold tracking-[-0.5px]">내 상품</h1>
          <Link
            href="/listings/new"
            className="rounded-[11px] border-2 border-primary-dark bg-primary px-4 py-2.5 text-[13.5px] font-bold text-white shadow-tactile-sm transition active:translate-y-0.5"
          >
            상품 등록
          </Link>
        </div>

        <div className="mb-3.5 flex flex-wrap gap-2">
          {STATUS_FILTERS.map(({ label, value }) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                setStatusFilter(value);
                setPage(0);
              }}
              className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition ${
                statusFilter === value
                  ? "border-primary-dark bg-primary text-white"
                  : "border-[#DDDDE3] bg-white text-[#4B4B52] hover:bg-neutral"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mb-5 flex items-center justify-between">
          <span className="text-[13px] font-semibold text-[#8A8A92]">
            {loadState === "ready" && pageData ? `총 ${pageData.totalElements}개` : ""}
          </span>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as MyListingsSort);
              setPage(0);
            }}
            className="rounded-[11px] border border-[#DDDDE3] px-3 py-2.5 text-[13px] font-semibold text-[#4B4B52] outline-none"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {loadState === "loading" && (
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-[72px] animate-pulse rounded-[14px] border border-[#EDEDF0] bg-[#F2F2F5]"
              />
            ))}
          </div>
        )}

        {loadState === "error" && (
          <div className="rounded-[18px] border border-[#F6C6C6] bg-[#FFF1F1] px-6 py-6 text-center text-[13.5px] text-[#C21414]">
            {errorMessage}
          </div>
        )}

        {loadState === "ready" && listings.length === 0 && (pageData?.totalElements ?? 0) === 0 && (
          <div className="rounded-[18px] border border-[#EDEDF0] bg-white px-10 py-[60px] text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#F2F2F5]">
              <svg
                width="38"
                height="38"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#C7C7CE"
                strokeWidth="1.6"
                aria-hidden="true"
              >
                <path d="M4 7l8-4 8 4v10l-8 4-8-4V7z" />
                <path d="M4 7l8 4 8-4M12 11v10" />
              </svg>
            </div>
            <h3 className="mb-0 mt-[18px] text-[16px] font-extrabold">등록된 상품이 없어요</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[#8A8A92]">
              첫 상품을 등록하고 판매를 시작해보세요.
            </p>
            <Link
              href="/listings/new"
              className="mt-5 inline-block rounded-[11px] border-2 border-primary-dark bg-primary px-6 py-2.5 text-[13.5px] font-bold text-white shadow-tactile-sm hover:text-white"
            >
              상품 등록하러 가기
            </Link>
          </div>
        )}

        {loadState === "ready" && listings.length === 0 && (pageData?.totalElements ?? 0) > 0 && (
          <div className="rounded-[18px] border border-[#EDEDF0] bg-white px-6 py-14 text-center text-[13.5px] text-[#8A8A92]">
            <p>해당 상태의 상품이 없습니다.</p>
            <button
              type="button"
              onClick={() => {
                setStatusFilter(null);
                setPage(0);
              }}
              className="mt-3 text-[12.5px] font-bold text-primary hover:text-primary-dark"
            >
              필터 초기화
            </button>
          </div>
        )}

        {loadState === "ready" && listings.length > 0 && (
          <div className="flex flex-col gap-2.5">
            {listings.map((listing) => (
              <div
                key={listing.id}
                className="flex flex-col gap-3 rounded-[14px] border border-[#EDEDF0] bg-white px-5 py-4"
              >
                <div className="flex items-center gap-4">
                  {/* 거래가 잡힌 상품은 카드 상세보다 거래 진행 상황이 먼저 궁금하므로 거래 상태
                      화면으로 보낸다. ACTIVE 상품은 tradeId가 없어 기존대로 카드 상세로 간다. */}
                  <Link
                    href={
                      listing.tradeId != null
                        ? `/trade-status/${listing.tradeId}`
                        : `/cards/${listing.cardId}`
                    }
                    className="flex min-w-0 flex-1 items-center gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[14.5px] font-bold text-ink hover:text-primary">
                          {listing.cardName ?? "알 수 없는 카드"}
                        </span>
                        <GradeBadgeInline grade={listing.grade} />
                      </div>
                      <div className="mt-1 text-[13px] text-[#8A8A92]">
                        {formatDate(listing.createdAt)}
                      </div>
                    </div>
                  </Link>
                  <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                    <span className="text-[15px] font-extrabold text-ink">
                      {listing.price.toLocaleString("ko-KR")}원
                    </span>
                    <StatusBadge status={listing.status} />
                  </div>
                </div>

                {listing.status === "ACTIVE" && editingId === listing.id && (
                  <div className="flex items-center gap-2 border-t border-[#EDEDF0] pt-3">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={editPrice ? Number(editPrice).toLocaleString("ko-KR") : ""}
                      onChange={(e) => setEditPrice(e.target.value.replace(/[^0-9]/g, ""))}
                      className="w-32 rounded-[9px] border border-[#DDDDE3] px-2.5 py-1.5 text-[13.5px] outline-none"
                    />
                    <button
                      type="button"
                      disabled={editSubmitting}
                      onClick={() => submitEdit(listing.id)}
                      className="rounded-[9px] border-2 border-primary-dark bg-primary px-3 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-60"
                    >
                      {editSubmitting ? "저장 중..." : "저장"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="rounded-[9px] border border-[#DDDDE3] px-3 py-1.5 text-[12.5px] font-semibold text-[#4B4B52]"
                    >
                      취소
                    </button>
                    {editError && (
                      <span className="text-[12px] font-semibold text-primary">{editError}</span>
                    )}
                  </div>
                )}

                {listing.status === "ACTIVE" && confirmDeleteId === listing.id && (
                  <div className="flex items-center gap-2 border-t border-[#EDEDF0] pt-3">
                    <span className="text-[13px] font-semibold text-[#C21414]">
                      정말 삭제하시겠어요?
                    </span>
                    <button
                      type="button"
                      disabled={deleteSubmitting}
                      onClick={() => confirmDelete(listing.id)}
                      className="rounded-[9px] border-2 border-primary-dark bg-primary px-3 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-60"
                    >
                      {deleteSubmitting ? "삭제 중..." : "삭제"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelDelete}
                      className="rounded-[9px] border border-[#DDDDE3] px-3 py-1.5 text-[12.5px] font-semibold text-[#4B4B52]"
                    >
                      취소
                    </button>
                    {deleteError && (
                      <span className="text-[12px] font-semibold text-primary">{deleteError}</span>
                    )}
                  </div>
                )}

                {listing.status === "ACTIVE" &&
                  editingId !== listing.id &&
                  confirmDeleteId !== listing.id && (
                    <div className="flex gap-2 border-t border-[#EDEDF0] pt-3">
                      <button
                        type="button"
                        onClick={() => startEdit(listing)}
                        className="rounded-[9px] border border-[#DDDDE3] px-3 py-1.5 text-[12.5px] font-semibold text-[#4B4B52] hover:text-primary"
                      >
                        가격 수정
                      </button>
                      <button
                        type="button"
                        onClick={() => startDelete(listing.id)}
                        className="rounded-[9px] border border-[#DDDDE3] px-3 py-1.5 text-[12.5px] font-semibold text-[#4B4B52] hover:text-primary"
                      >
                        삭제
                      </button>
                    </div>
                  )}

                {listing.status !== "ACTIVE" && listing.tradeId != null && (
                  <div className="flex gap-2 border-t border-[#EDEDF0] pt-3">
                    <Link
                      href={`/trade-status/${listing.tradeId}`}
                      className="rounded-[9px] border border-[#DDDDE3] px-3 py-1.5 text-[12.5px] font-semibold text-[#4B4B52] hover:text-primary"
                    >
                      거래 확인
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {loadState === "ready" && pageData && pageData.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-1.5">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-[9px] border border-[#DDDDE3] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#4B4B52] disabled:opacity-40"
            >
              이전
            </button>
            {Array.from({ length: pageData.totalPages }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPage(i)}
                className={`h-8 w-8 rounded-[9px] text-[12.5px] font-bold transition ${
                  page === i
                    ? "bg-primary text-white"
                    : "border border-[#DDDDE3] bg-white text-[#4B4B52] hover:bg-neutral"
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              type="button"
              disabled={page >= pageData.totalPages - 1}
              onClick={() => setPage((p) => Math.min(pageData.totalPages - 1, p + 1))}
              className="rounded-[9px] border border-[#DDDDE3] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#4B4B52] disabled:opacity-40"
            >
              다음
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
