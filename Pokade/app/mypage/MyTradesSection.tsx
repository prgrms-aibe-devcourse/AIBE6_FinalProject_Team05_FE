"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import CardImage from "@/components/CardImage";
import { PageResponse } from "@/lib/apiClient";
import { fetchMyTrades } from "@/lib/tradeApi";
import { MyTradeResponse, TradeRole, TradeStatus } from "@/types/trade";

const PAGE_SIZE = 10;

type StatusKey = "all" | "ongoing" | "done" | "cancelled";

// '진행중'이 어떤 상태들인지는 화면 사정이라 FE가 정의한다 — BE는 원시 상태 다중값만 받는다.
const STATUS_GROUPS: Record<StatusKey, TradeStatus[] | undefined> = {
  all: undefined,
  ongoing: ["PENDING", "SHIPPED_TO_PLATFORM", "INSPECTED", "DELIVERED"],
  done: ["COMPLETED"],
  cancelled: ["CANCELLED"],
};

const STATUS_FILTERS: { key: StatusKey; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "ongoing", label: "진행중" },
  { key: "done", label: "완료" },
  { key: "cancelled", label: "취소" },
];

// 구매자·판매자 어느 쪽에서 봐도 말이 되는 중립 표현으로 둔다.
const STATUS_LABEL: Record<TradeStatus, string> = {
  PENDING: "발송 대기",
  SHIPPED_TO_PLATFORM: "검수 중",
  INSPECTED: "배송 준비",
  DELIVERED: "구매 확정 대기",
  COMPLETED: "거래 완료",
  CANCELLED: "취소됨",
};

const STATUS_TONE: Record<TradeStatus, string> = {
  PENDING: "bg-[#FFF7E8] text-[#9A6B00]",
  SHIPPED_TO_PLATFORM: "bg-[#FFF7E8] text-[#9A6B00]",
  INSPECTED: "bg-[#EEF3FF] text-[#2B4EA2]",
  DELIVERED: "bg-[#EEF3FF] text-[#2B4EA2]",
  COMPLETED: "bg-[#EAF7EE] text-[#1E7A3C]",
  CANCELLED: "bg-[#F3F3F5] text-[#8A8A92]",
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function MyTradesSection() {
  // useSearchParams는 Suspense 경계가 필요 — 이 섹션만 감싸 마이페이지 나머지의 prerender를 막지 않는다.
  return (
    <Suspense
      fallback={
        <div className="mt-3 h-52 rounded-[18px] border border-[#EDEDF0] bg-white shadow-card" />
      }
    >
      <MyTradesSectionInner />
    </Suspense>
  );
}

function MyTradesSectionInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 탭·페이지는 URL이 단일 진실 — 거래 상세에 들어갔다 뒤로가기로 돌아와도 보던 위치가 복원된다.
  const tab: TradeRole = searchParams.get("tab") === "sell" ? "SELL" : "BUY";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const [statusKey, setStatusKey] = useState<StatusKey>("all");
  // 조회 조건을 키로 함께 보관하고 "지금 조건의 결과인지"를 파생 계산한다. effect 안에서 로딩
  // 플래그를 직접 세우지 않아도 되고(react-hooks/set-state-in-effect), 뒤로가기로 조건이 바뀌는
  // 경우도 핸들러 없이 자동으로 로딩 상태가 된다.
  const [loaded, setLoaded] = useState<{
    key: string;
    page: PageResponse<MyTradeResponse>;
  } | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [counts, setCounts] = useState<{ BUY: number | null; SELL: number | null }>({
    BUY: null,
    SELL: null,
  });

  const requestKey = `${tab}|${statusKey}|${page}`;

  // 탭 라벨의 건수 — size=1로 totalElements만 받는다. 목록은 아래 effect가 따로 가져온다.
  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchMyTrades({ role: "BUY", size: 1 }), fetchMyTrades({ role: "SELL", size: 1 })])
      .then(([buy, sell]) => {
        if (!cancelled) setCounts({ BUY: buy.totalElements, SELL: sell.totalElements });
      })
      .catch(() => {
        // 건수는 부가 정보 — 실패해도 목록 자체는 그대로 보여준다.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const key = requestKey;
    fetchMyTrades({
      role: tab,
      statuses: STATUS_GROUPS[statusKey],
      page: page - 1, // URL은 1-based(사람이 읽는 값), 서버는 0-based
      size: PAGE_SIZE,
    })
      .then((res) => {
        if (!cancelled) setLoaded({ key, page: res });
      })
      .catch(() => {
        if (!cancelled) setErrorKey(key);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, statusKey, page, requestKey]);

  function updateQuery(next: { tab?: TradeRole; page?: number }) {
    const q = new URLSearchParams(searchParams.toString());
    if (next.tab !== undefined) {
      if (next.tab === "SELL") q.set("tab", "sell");
      else q.delete("tab");
    }
    if (next.page !== undefined) {
      if (next.page > 1) q.set("page", String(next.page));
      else q.delete("page");
    }
    const qs = q.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const data = loaded?.key === requestKey ? loaded.page : null;
  const isError = errorKey === requestKey;
  const isLoading = !data && !isError;
  const trades = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;

  return (
    <section className="mt-3 rounded-[18px] border border-[#EDEDF0] bg-white px-8 py-7 shadow-card">
      <h2 className="mb-4 text-[17px] font-extrabold">거래 내역</h2>

      <div className="mb-3 flex gap-1 border-b border-[#EDEDF0]">
        {(["BUY", "SELL"] as const).map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => updateQuery({ tab: role, page: 1 })}
            className={
              tab === role
                ? "border-b-2 border-primary px-4 py-2 text-[14px] font-extrabold text-primary"
                : "px-4 py-2 text-[14px] font-semibold text-[#8A8A92] hover:text-[#4B4B52]"
            }
          >
            {role === "BUY" ? "구매" : "판매"}
            {counts[role] !== null && (
              <span className="ml-1.5 text-[12.5px] font-bold">{counts[role]}</span>
            )}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => {
              setStatusKey(f.key);
              updateQuery({ page: 1 });
            }}
            className={
              statusKey === f.key
                ? "rounded-full bg-primary px-3 py-1 text-[12px] font-bold text-white"
                : "rounded-full border border-[#EDEDF0] px-3 py-1 text-[12px] font-semibold text-[#8A8A92] hover:bg-[#F5F5F7]"
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="py-10 text-center text-[13.5px] text-[#8A8A92]">불러오는 중…</p>}

      {isError && (
        <p className="py-10 text-center text-[13.5px] text-[#C21414]">
          거래 내역을 불러오지 못했습니다.
        </p>
      )}

      {data && trades.length === 0 && <EmptyState tab={tab} filtered={statusKey !== "all"} />}

      {data && trades.length > 0 && (
        <ul className="flex flex-col gap-2">
          {trades.map((t) => (
            <li key={t.tradeId}>
              <Link
                href={`/trade-status/${t.tradeId}`}
                className="flex items-center gap-3 rounded-[10px] border border-[#EDEDF0] p-3 hover:bg-[#FAFAFB]"
              >
                {/* CardImage는 next/image의 fill을 쓴다 — 크기는 relative 부모가 정해야 한다. */}
                <div className="relative h-14 w-10 flex-shrink-0 overflow-hidden rounded-[7px] bg-[#F2F2F5]">
                  <CardImage src={t.cardImageUrl ?? undefined} alt={t.cardName ?? "카드"} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-bold text-[#3A3A42]">
                    {t.cardName ?? "알 수 없는 카드"}
                  </p>
                  <p className="text-[12px] text-[#8A8A92]">
                    {t.price.toLocaleString("ko-KR")}원 · {formatDateTime(t.createdAt)}
                  </p>
                </div>
                <span
                  className={`flex-none rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_TONE[t.status]}`}
                >
                  {STATUS_LABEL[t.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {data && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-5 text-[13px]">
          <button
            type="button"
            onClick={() => updateQuery({ page: page - 1 })}
            disabled={page <= 1}
            className="text-[#4B4B52] disabled:text-[#C9C9CF]"
          >
            ‹ 이전
          </button>
          <span className="font-bold">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => updateQuery({ page: page + 1 })}
            disabled={page >= totalPages}
            className="text-[#4B4B52] disabled:text-[#C9C9CF]"
          >
            다음 ›
          </button>
        </div>
      )}
    </section>
  );
}

function EmptyState({ tab, filtered }: { tab: TradeRole; filtered: boolean }) {
  // 필터 때문에 비었는지, 애초에 거래가 없는지를 구분해야 엉뚱한 곳으로 유도하지 않는다.
  if (filtered) {
    return (
      <p className="py-10 text-center text-[13.5px] text-[#8A8A92]">해당 조건의 거래가 없습니다.</p>
    );
  }
  return (
    <div className="py-9 text-center">
      <p className="mb-3 text-[13.5px] text-[#8A8A92]">
        {tab === "BUY" ? "아직 구매한 카드가 없어요." : "아직 판매한 카드가 없어요."}
      </p>
      <Link
        href={tab === "BUY" ? "/search" : "/listings/new"}
        className="inline-block rounded-[10px] border-2 border-primary-dark bg-primary px-[18px] py-[9px] text-[13.5px] font-bold text-white hover:bg-[#D91212] hover:text-white"
      >
        {tab === "BUY" ? "마켓 둘러보기" : "상품 등록하기"}
      </Link>
    </div>
  );
}
