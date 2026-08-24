"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AddWatchlistModal from "@/components/AddWatchlistModal";
import Breadcrumb from "@/components/Breadcrumb";
import IconTooltip from "@/components/IconTooltip";
import SelectMenu from "@/components/SelectMenu";
import Toast from "@/components/Toast";
import CardImage from "@/components/CardImage";
import { useEscapeAndScrollLock } from "@/hooks/useEscapeAndScrollLock";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useToast } from "@/hooks/useToast";
import { ApiError } from "@/lib/apiClient";
import { resolvePriceDisplay } from "@/lib/priceDisplay";
import { deleteWatchlistItem, fetchWatchlist, updateWatchlist } from "@/lib/watchlistApi";
import { WatchlistResponse } from "@/types/watchlist";

// BE에는 targetReached(현재 시점 목표가 범위 진입 여부)만 있고 "확인함"에 대응하는 필드가
// 없어 2단계로 축소. isNotified(알림 발송 이력, 1회성 플래그)와 달리 targetReached는 매 조회
// 시점 실시간 체결가 기준으로 재계산되는 값이라 — 알림이 이미 갔어도 그 뒤 가격이 범위를
// 벗어나면 다시 false가 될 수 있다. 상태 배지는 "지금" 기준을 보여줘야 하므로 이 값을 쓴다.
// 예전에는 targetReached만 보고 "대기중/목표도달" 둘로 나눴는데, 그러면 목표가를 아직 정하지
// 않은 카드까지 "대기중"이 됐다(#238) — 알림이 올 수 없는 상태인데 기다리는 중인 것처럼 보인다.
// 목표가 유무를 앞에서 한 번 더 갈라 세 상태로 만든다.
type Status = "미설정" | "대기중" | "목표도달";
const STATUS_CLS: Record<Status, string> = {
  // 아직 아무것도 정하지 않은 중립 상태 — 앰버(대기중)와 확실히 구분되도록 회색 계열.
  미설정: "bg-neutral text-[#8A8A92]",
  대기중: "bg-[#FFF3CE] text-[#8A6A00]",
  목표도달: "bg-[#E8F7EF] text-[#087a4e]",
};

// 상태 배지 — 텍스트 앞에 8px 색상 도트를 두어 한눈에 스캔되게 한다(#238). 도트는 bg-current로
// 배지 텍스트 색을 그대로 따라가므로 상태별 색을 새로 만들지 않는다(기존 토큰 확장). 데스크톱
// 표/모바일 카드 두 곳에서 같은 마크업을 쓰므로 한 컴포넌트로 합친다.
function StatusBadge({ status, className = "" }: { status: Status; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-[11px] py-[5px] text-xs font-bold ${STATUS_CLS[status]} ${className}`}
    >
      <i className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
      {status}
    </span>
  );
}

// 배지 3종의 뜻. 배지에는 아무 설명이 없고, 뜻을 짐작하게 해 주던 안내 문구는 빈 상태 카드
// 안에만 있어 카드가 한 장이라도 생기면 사라진다 — 특히 "대기중"은 배지만 봐서는 무엇을
// 기다리는 중인지(목표가 도달 전) 알 수 없다. 표 헤더의 도움말 아이콘 한 곳에서만 노출한다.
//
// name을 string이 아니라 Status로 묶어 둔다 — 상태 이름이 바뀌거나 늘었을 때 설명이 조용히
// 어긋나는 대신 컴파일에서 걸리게 하기 위함이다.
const STATUS_HELP: { name: Status; desc: string }[] = [
  { name: "미설정", desc: "목표가 없음" },
  { name: "대기중", desc: "목표가 도달 전" },
  { name: "목표도달", desc: "알림 발송됨" },
];

type LoadState = "loading" | "error" | "ready";
type Filter = "all" | "unset" | "wait" | "reached";
type Sort = "oldest" | "latest";

const TABS: { key: Filter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "unset", label: "미설정" },
  { key: "wait", label: "대기중" },
  { key: "reached", label: "목표도달" },
];

// 현재 BE(findByUserId, OrderBy 없음)가 사실상 등록 오래된순으로 내려주므로 이를 기본값으로 둔다.
// 재정렬은 순수 클라이언트 처리 — 최대 20개(WATCHLIST_LIMIT)라 재요청 없이 바로 정렬 가능.
const SORT_OPTIONS: { key: Sort; label: string }[] = [
  { key: "oldest", label: "등록 오래된순" },
  { key: "latest", label: "등록 최신순" },
];

// BE WatchlistService.WATCHLIST_LIMIT(= 20)과 맞출 것. API로 노출되지 않아 하드코딩.
const WATCHLIST_LIMIT = 20;

// 목표가를 하나도 정하지 않은 상태 — 하트만 눌러 등록하면(빠른 등록) 여기서 시작한다.
// 배지와 필터 탭이 같은 기준을 쓰도록 판정을 한 곳에 둔다.
function hasNoTarget(item: WatchlistResponse): boolean {
  return item.targetBuyPrice == null && item.targetSellPrice == null;
}

function statusOf(item: WatchlistResponse): Status {
  if (hasNoTarget(item)) return "미설정";
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
          {/* 모달 오픈 시 삭제 버튼으로 포커스 이동 — 엔터로 즉시 확정 가능.
              마운트 시 submitting은 항상 false라 autoFocus가 정상 동작한다. */}
          <button
            type="button"
            autoFocus
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

// 목표가는 하나도 없을 수 있다 — 하트로만 등록한 카드(빠른 등록)가 그렇고, 수정 모달에서
// 두 칸을 모두 지워 미설정으로 되돌린 경우도 그렇다(clearTargetBuyPrice/clearTargetSellPrice).
// 빈 배열이 정상 결과이므로 호출부는 targets.length로 "설정하기" 안내와 갈라 준다.
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

// 테이블 행(데스크톱)과 카드(모바일, <640px)가 같은 원본 데이터에서 같은 파생값을 쓰므로
// 계산 자체는 여기서 한 번만 하고, 두 레이아웃은 이 값을 각자의 마크업으로만 배치한다.
function rowDisplay(row: WatchlistResponse) {
  const displayName = row.cardNameKo ?? row.cardName ?? "알 수 없는 카드";
  const priceLabel = resolvePriceDisplay(row.currentPrice ?? undefined)?.price ?? "정보 없음";
  const targets = formatTargets(row);
  const status = statusOf(row);
  const changeRate = row.changeRate;
  const isRise = changeRate != null && changeRate >= 0;
  const changeCls = isRise ? "text-primary" : "text-secondary";
  return { displayName, priceLabel, targets, status, changeRate, isRise, changeCls };
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
  const { toast, showToast, pauseToast, resumeToast } = useToast();

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

  // 탭과 배지가 어긋나지 않도록 둘 다 statusOf()를 기준으로 센다 — 예전에는 탭이
  // targetReached만 봐서 "대기중" 탭 안에 목표가 미설정 카드가 섞여 있었다(#238).
  const counts: Record<Filter, number> = {
    all: rows.length,
    unset: rows.filter((r) => statusOf(r) === "미설정").length,
    wait: rows.filter((r) => statusOf(r) === "대기중").length,
    reached: rows.filter((r) => statusOf(r) === "목표도달").length,
  };

  const filtered = rows.filter((r) => {
    if (filter === "unset") return statusOf(r) === "미설정";
    if (filter === "wait") return statusOf(r) === "대기중";
    if (filter === "reached") return statusOf(r) === "목표도달";
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return sort === "oldest" ? diff : -diff;
  });

  // whitespace-nowrap이 없으면 좁은 화면에서 버튼이 눌려 "목표도달 1"이 글자 단위로 줄바꿈된다
  // (360px 기준 탭 높이 79px → 탭이 하나 늘어난 뒤 119px). 아래 컨테이너의 flex-wrap과 한 쌍이다.
  const tabCls = (active: boolean) =>
    `shrink-0 whitespace-nowrap rounded-[10px] border-[1.5px] px-[15px] py-2 text-[13.5px] cursor-pointer ${
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
    // 저장이 됐는지, 이제 알림이 오는지가 화면 어디에도 안 적혀 있었다(#238) — 모달만 닫히고
    // 행의 숫자가 조용히 바뀌는 게 전부였다. 목표가를 지운 경우까지 "알려드릴게요"라고 하면
    // 거짓이 되므로 남은 목표가가 있을 때만 알림 문구를 붙인다.
    const hasTarget = updated.targetBuyPrice != null || updated.targetSellPrice != null;
    showToast({
      message: hasTarget ? "목표가를 저장했어요. 도달하면 알려드릴게요" : "목표가를 지웠어요",
    });
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
    <main className="main-content bg-neutral px-4 pb-14 pt-9 sm:px-10">
      <div className="mx-auto max-w-[1200px]">
        <Breadcrumb className="mb-3" items={[{ label: "홈", href: "/" }, { label: "관심 목록" }]} />
        <div className="mb-[22px] flex items-end justify-between">
          <div>
            <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.6px]">관심 목록</h1>
            <p className="mt-1.5 text-sm text-[#8A8A92]">
              관심 카드의 목표가 도달 알림을 관리하세요
            </p>
          </div>
          {/* 상한 대비 현재 등록 수. rows는 원본이라 탭 필터와 무관하게 총계를 유지한다.
              18개 이상(남은 자리 2개 이하)에서 앰버로 전환, 색각 이상 대비 문구도 함께 표시. */}
          {loadState === "ready" && rows.length > 0 && (
            <p
              className={`m-0 whitespace-nowrap text-[13px] font-semibold ${
                rows.length >= WATCHLIST_LIMIT - 2 ? "text-[#8A6A00]" : "text-[#8A8A92]"
              }`}
            >
              {rows.length} / {WATCHLIST_LIMIT}개 등록됨
              {rows.length >= WATCHLIST_LIMIT - 2 && ` · ${WATCHLIST_LIMIT - rows.length}개 남음`}
            </p>
          )}
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
              href="/search?sort=popular"
              className="mt-[26px] inline-block rounded-[11px] border-2 border-primary-dark bg-primary px-[26px] py-3 text-[14.5px] font-bold text-white shadow-tactile-sm hover:text-white"
            >
              인기 카드 보기
            </Link>
          </div>
        )}

        {loadState === "ready" && rows.length > 0 && (
          <>
            {/* 탭이 4개로 늘면서(#238) 좁은 화면에서 한 줄에 안 들어간다 — 눌러서 찌그러뜨리는
                대신 줄바꿈으로 흘린다(정렬 셀렉트도 자리가 없으면 아래 줄로 내려간다). */}
            <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
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
              {/* 네이티브 select의 펼침 목록은 OS가 그려 CSS가 닿지 않아, 박스와 목록의
                  모서리·톤을 맞춘 커스텀 드롭다운(SelectMenu)으로 교체(#238). */}
              <SelectMenu value={sort} options={SORT_OPTIONS} onChange={setSort} ariaLabel="정렬" />
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
              <>
                <div className="hidden overflow-hidden rounded-2xl border border-[#EDEDF0] bg-white sm:block">
                  {/* 좁은 화면에서 grid-cols가 찌그러지는 대신 테이블 박스 안에서만 가로 스크롤되도록
                    분리된 스크롤 컨테이너 — min-w는 6개 컬럼이 한 줄로 안 뭉개지는 최소 폭.
                    다만 sm 미만은 이 스크롤로도 등락/상태/액션이 화면 밖으로 밀려 접근성이
                    나빠서, 아래 카드 리스트로 통째로 전환한다(위 hidden sm:block). */}
                  <div className="overflow-x-auto">
                    <div className="min-w-[760px]">
                      <div className="grid grid-cols-[2.4fr_1fr_1fr_1fr_1fr_0.6fr] gap-4 border-b border-[#EDEDF0] bg-[#FAFAFB] px-[22px] py-3.5 text-xs font-bold text-[#9A9AA2]">
                        <div>카드</div>
                        <div>현재 시세</div>
                        <div>목표가</div>
                        <div>등락</div>
                        {/* 도움말은 이 헤더 한 곳에만 둔다 — 행마다 붙이면 20번 반복되고, 뜻은
                            행이 아니라 컬럼 전체에 걸리는 정보다. placement가 top이 아닌 이유:
                            헤더는 표의 첫 줄이고 바깥 래퍼가 overflow-hidden이라 위로 뜨면
                            잘린다. align이 right인 이유: 상태 컬럼이 표 오른쪽 끝(가로 87%
                            지점)이라 중앙 정렬이면 툴팁 절반이 컨테이너 밖으로 나간다. */}
                        <div className="flex items-center gap-1">
                          상태
                          <IconTooltip
                            placement="bottom"
                            align="right"
                            label={
                              <span className="flex flex-col gap-1 text-left font-normal">
                                {STATUS_HELP.map(({ name, desc }) => (
                                  <span key={name}>
                                    <b className="font-bold">{name}</b> — {desc}
                                  </span>
                                ))}
                              </span>
                            }
                          >
                            {/* 툴팁 본문은 aria-hidden(IconTooltip)이라 스크린리더에는 이
                                aria-label만 전달된다. 누를 것이 없는 도움말이지만 button으로
                                두는 이유는 키보드 포커스 — group-focus-within으로 툴팁이
                                뜨려면 초점을 받을 수 있어야 한다. */}
                            <button
                              type="button"
                              aria-label={`상태 설명. ${STATUS_HELP.map(({ name, desc }) => `${name}은 ${desc}`).join(", ")}`}
                              className="flex h-4 w-4 items-center justify-center rounded-full text-[#C4C4CC] outline-none transition-colors hover:text-[#8A8A92] focus-visible:ring-2 focus-visible:ring-secondary"
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <circle cx="12" cy="12" r="10" />
                                <path d="M9.2 9.2a2.9 2.9 0 015.6 1c0 1.9-2.8 2.4-2.8 2.4" />
                                <path d="M12 17.2h.01" />
                              </svg>
                            </button>
                          </IconTooltip>
                        </div>
                        <div />
                      </div>
                      {sorted.map((row, i) => {
                        const {
                          displayName,
                          priceLabel,
                          targets,
                          status,
                          changeRate,
                          isRise,
                          changeCls,
                        } = rowDisplay(row);
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
                            {/* 목표가 칸 자체가 수정 진입점이다(#238) — 예전에는 값이 없을 때 "-"만
                                찍혀 있어 눌러도 아무 일이 없었고, 실제 진입점은 행 오른쪽 끝의 연필
                                아이콘 하나뿐이라 처음 온 사람은 목표가를 어디서 넣는지 찾지 못했다.
                                값이 있든 없든 같은 모달을 열어, "여기 적힌 걸 고치고 싶다"는 자연스러운
                                클릭이 그대로 통하게 한다. */}
                            <button
                              type="button"
                              onClick={() => setEditingItem(row)}
                              aria-label={`${displayName} 목표가 ${targets.length > 0 ? "수정" : "설정"}`}
                              className="rounded-lg px-1.5 py-1 text-left text-sm text-[#4B4B52] outline-none transition-colors hover:bg-neutral focus-visible:ring-2 focus-visible:ring-secondary"
                            >
                              {targets.length > 0 ? (
                                targets.map((t) => (
                                  // 라벨과 값을 각각 span으로 끊어 flex 항목으로 만든다 —
                                  // 한 텍스트 흐름이면 컬럼이 좁아질 때 "목표 구매가: 12,"에서
                                  // 꺾여 금액이 두 동강 난다. 끊어 두면 자리가 모자랄 때 값이
                                  // 통째로 아랫줄로 내려가고(flex-wrap), 값 쪽 whitespace-nowrap이
                                  // 금액 자체는 절대 쪼개지지 않게 잡아 준다.
                                  //
                                  // 금액만 font-semibold — 라벨까지 굵게 하면 같은 행의 현재 시세
                                  // (font-bold)와 무게가 뒤엉켜 어느 쪽이 값인지 흐려진다. 모바일
                                  // 카드(아래)도 값 span만 semibold라 두 레이아웃이 같아진다.
                                  <div key={t.label} className="flex flex-wrap gap-x-1">
                                    <span>{t.label}:</span>
                                    <span className="whitespace-nowrap font-semibold">
                                      {t.value}
                                    </span>
                                  </div>
                                ))
                              ) : (
                                <span className="font-semibold text-secondary">
                                  목표가 설정하기
                                </span>
                              )}
                            </button>
                            <div
                              className={`text-[13.5px] font-bold ${
                                changeRate != null && changeRate !== 0
                                  ? changeCls
                                  : "text-[#9A9AA2]"
                              }`}
                            >
                              {changeRate != null && changeRate !== 0
                                ? `${isRise ? "▲" : "▼"} ${Math.abs(changeRate).toFixed(2)}%`
                                : "-"}
                            </div>
                            <div>
                              <StatusBadge status={status} />
                            </div>
                            <div className="flex items-center justify-end gap-3">
                              {/* 아이콘만 있는 버튼이라 시각 사용자에게도 이름을 보여준다(#238) —
                                  aria-label만으로는 스크린리더 사용자만 용도를 알 수 있었다.
                                  placement="top": 첫 행 위에는 테이블 헤더가 있어 스크롤 컨테이너
                                  안쪽에 그려지므로 잘리지 않는다(실측 확인). */}
                              <IconTooltip label="목표가 수정" placement="top" className="-m-3.5">
                                <button
                                  type="button"
                                  aria-label={`${displayName} 목표가 수정`}
                                  onClick={() => setEditingItem(row)}
                                  className="p-3.5 text-[#8A8A92] hover:text-primary"
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
                              </IconTooltip>
                              {row.isNotified && (
                                <IconTooltip
                                  label="알림 다시 받기"
                                  placement="top"
                                  className="-m-3.5"
                                >
                                  <button
                                    type="button"
                                    aria-label={`${displayName} 알림 다시 받기`}
                                    disabled={resendingId === row.id}
                                    onClick={() => handleResendNotification(row.id)}
                                    className="p-3.5 text-[#8A8A92] hover:text-primary disabled:opacity-50"
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
                                </IconTooltip>
                              )}
                              <IconTooltip label="삭제" placement="top" className="-m-3.5">
                                <button
                                  type="button"
                                  aria-label={`${displayName} 관심 목록에서 삭제`}
                                  disabled={deletingId === row.id}
                                  onClick={() => setDeleteTarget(row)}
                                  className="p-3.5 text-[#8A8A92] hover:text-primary disabled:opacity-50"
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
                              </IconTooltip>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* sm 미만 전용 — 위 테이블은 hidden sm:block, 이 카드 리스트는 sm:hidden.
                  등락/상태/액션이 스크롤 없이도 한 화면에 다 보이도록 1열로 쌓는다. */}
                <div className="flex flex-col gap-3 sm:hidden">
                  {sorted.map((row) => {
                    const {
                      displayName,
                      priceLabel,
                      targets,
                      status,
                      changeRate,
                      isRise,
                      changeCls,
                    } = rowDisplay(row);
                    return (
                      <div
                        key={row.id}
                        className="rounded-2xl border border-[#EDEDF0] bg-white p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
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
                          <StatusBadge status={status} className="flex-shrink-0" />
                        </div>

                        <div className="mt-3.5 flex flex-col gap-1.5 border-t border-[#F2F2F5] pt-3 text-[13px]">
                          <div className="flex items-center justify-between">
                            <span className="text-[#9A9AA2]">현재 시세</span>
                            <span className="font-bold">{priceLabel}</span>
                          </div>
                          {/* 데스크톱과 같은 이유로 목표가 줄 전체가 수정 진입점이다(#238).
                              모바일은 hover가 없어 연필 아이콘의 의미를 알기가 더 어렵다. */}
                          <button
                            type="button"
                            onClick={() => setEditingItem(row)}
                            aria-label={`${displayName} 목표가 ${targets.length > 0 ? "수정" : "설정"}`}
                            className="-mx-1.5 flex flex-col gap-1.5 rounded-lg px-1.5 py-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-secondary active:bg-neutral"
                          >
                            {targets.length > 0 ? (
                              targets.map((t) => (
                                <div
                                  key={t.label}
                                  className="flex w-full items-center justify-between gap-x-2"
                                >
                                  {/* 여기는 데스크톱처럼 flex-wrap으로 바꾸지 않는다 —
                                      justify-between이라 값이 아랫줄로 내려가면 오른쪽 정렬이
                                      풀려 왼쪽에 홀로 붙는다. 대신 값이 숫자 중간에서 꺾이는
                                      것만 막고(둘 다 flex 항목이라 기본적으로 줄어들 수 있다),
                                      자리가 모자라면 라벨 쪽이 줄어들게 둔다. */}
                                  <span className="text-[#9A9AA2]">{t.label}</span>
                                  <span className="whitespace-nowrap font-semibold text-[#4B4B52]">
                                    {t.value}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <div className="flex w-full items-center justify-between">
                                <span className="text-[#9A9AA2]">목표가</span>
                                <span className="font-semibold text-secondary">설정하기</span>
                              </div>
                            )}
                          </button>
                          <div className="flex items-center justify-between">
                            <span className="text-[#9A9AA2]">등락</span>
                            <span
                              className={`font-bold ${
                                changeRate != null && changeRate !== 0
                                  ? changeCls
                                  : "text-[#9A9AA2]"
                              }`}
                            >
                              {changeRate != null && changeRate !== 0
                                ? `${isRise ? "▲" : "▼"} ${Math.abs(changeRate).toFixed(2)}%`
                                : "-"}
                            </span>
                          </div>
                        </div>

                        <div className="mt-3.5 flex items-center justify-end gap-3 border-t border-[#F2F2F5] pt-3">
                          {/* 모바일에도 같은 툴팁을 단다 — hover가 없어 실질 효과는 키보드 포커스
                              때뿐이지만, 아이콘 구성이 데스크톱과 같아 두 레이아웃이 어긋나지 않게
                              한다(#238). */}
                          <IconTooltip label="목표가 수정" placement="top" className="-m-2.5">
                            <button
                              type="button"
                              aria-label={`${displayName} 목표가 수정`}
                              onClick={() => setEditingItem(row)}
                              className="p-2.5 text-[#8A8A92] hover:text-primary"
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
                          </IconTooltip>
                          {row.isNotified && (
                            <IconTooltip label="알림 다시 받기" placement="top" className="-m-2.5">
                              <button
                                type="button"
                                aria-label={`${displayName} 알림 다시 받기`}
                                disabled={resendingId === row.id}
                                onClick={() => handleResendNotification(row.id)}
                                className="p-2.5 text-[#8A8A92] hover:text-primary disabled:opacity-50"
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
                            </IconTooltip>
                          )}
                          <IconTooltip label="삭제" placement="top" className="-m-2.5">
                            <button
                              type="button"
                              aria-label={`${displayName} 관심 목록에서 삭제`}
                              disabled={deletingId === row.id}
                              onClick={() => setDeleteTarget(row)}
                              className="p-2.5 text-[#8A8A92] hover:text-primary disabled:opacity-50"
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
                          </IconTooltip>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
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
          currentPriceLabel={rowDisplay(editingItem).priceLabel}
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
      {/* 목표가 저장 결과 알림(#238) — 홈/카드상세/마켓과 같은 토스트를 쓴다. */}
      <Toast toast={toast} onPause={pauseToast} onResume={resumeToast} />
    </main>
  );
}
