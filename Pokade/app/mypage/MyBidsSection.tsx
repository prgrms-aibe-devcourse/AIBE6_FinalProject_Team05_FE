"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import CardImage from "@/components/CardImage";
import { PageResponse } from "@/lib/apiClient";
import { fetchMyBuyOffers } from "@/lib/buyOfferApi";
import { fetchMyListings } from "@/lib/listingApi";
import { ListingStatus, ListingSummaryResponse, MyBuyOfferResponse } from "@/types/price";

const PAGE_SIZE = 10;

type BidTab = "buyOffer" | "listing";

const TABS: { key: BidTab; label: string }[] = [
  { key: "buyOffer", label: "구매입찰" },
  { key: "listing", label: "판매 등록" },
];

// BuyOffer.status는 BE에서 아직 별도 enum이 아니라 문자열이라(entity 자체가 raw String) 느슨하게 둔다.
const BUY_OFFER_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "입찰중",
  MATCHED: "체결됨",
  PARTIAL: "부분체결",
  EXPIRED: "기간만료",
  CANCELLED: "취소됨",
};

const BUY_OFFER_STATUS_TONE: Record<string, string> = {
  ACTIVE: "bg-[#E8F7EF] text-[#059669]",
  MATCHED: "bg-lavender text-secondary",
  PARTIAL: "bg-lavender text-secondary",
  EXPIRED: "bg-[#EEF0F2] text-[#9A9AA2]",
  CANCELLED: "bg-[#EEF0F2] text-[#9A9AA2]",
};

// /listings/me/page.tsx의 STATUS_LABELS/STATUS_STYLES와 동일한 문구/색상 — 같은 상태를 다른 화면에서
// 다르게 표현하면 혼란을 주므로 그대로 맞춘다.
const LISTING_STATUS_LABEL: Record<ListingStatus, string> = {
  ACTIVE: "판매중",
  TRADING: "거래중",
  SOLD: "판매완료",
  EXPIRED: "기간만료",
  CANCELLED: "취소됨",
  HIDDEN: "숨김",
};

const LISTING_STATUS_TONE: Record<ListingStatus, string> = {
  ACTIVE: "bg-[#E8F7EF] text-[#059669]",
  TRADING: "bg-lavender text-secondary",
  SOLD: "bg-[#EEF0F2] text-[#4B4B52]",
  EXPIRED: "bg-[#EEF0F2] text-[#9A9AA2]",
  CANCELLED: "bg-[#EEF0F2] text-[#9A9AA2]",
  HIDDEN: "bg-[#EEF0F2] text-[#9A9AA2]",
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function MyBidsSection() {
  // useSearchParams는 Suspense 경계가 필요 — MyTradesSection과 동일한 이유.
  return (
    <Suspense
      fallback={
        <div className="mt-3 h-52 rounded-[18px] border border-[#EDEDF0] bg-white shadow-card" />
      }
    >
      <MyBidsSectionInner />
    </Suspense>
  );
}

function MyBidsSectionInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // MyTradesSection이 이미 이 페이지에서 tab/page 쿼리를 쓰고 있어, 같은 이름을 쓰면 두 섹션의
  // 상태가 서로 덮어써진다 — bidTab/bidPage로 구분한다.
  const tab: BidTab = searchParams.get("bidTab") === "listing" ? "listing" : "buyOffer";
  const page = Math.max(1, Number(searchParams.get("bidPage")) || 1);

  const [buyOfferResult, setBuyOfferResult] = useState<{
    key: string;
    page: PageResponse<MyBuyOfferResponse> | null;
  } | null>(null);
  const [listingResult, setListingResult] = useState<{
    key: string;
    page: PageResponse<ListingSummaryResponse> | null;
  } | null>(null);
  const [counts, setCounts] = useState<{ buyOffer: number | null; listing: number | null }>({
    buyOffer: null,
    listing: null,
  });

  const requestKey = `${tab}|${page}`;

  // 탭 라벨의 건수 — size=1로 totalElements만 받는다.
  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchMyBuyOffers(undefined, 0, 1), fetchMyListings(undefined, 0, 1)])
      .then(([buyOffers, listings]) => {
        if (!cancelled) {
          setCounts({ buyOffer: buyOffers.totalElements, listing: listings.totalElements });
        }
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
    if (tab === "buyOffer") {
      fetchMyBuyOffers(undefined, page - 1, PAGE_SIZE)
        .then((res) => {
          if (!cancelled) setBuyOfferResult({ key, page: res });
        })
        .catch(() => {
          if (!cancelled) setBuyOfferResult({ key, page: null });
        });
    } else {
      fetchMyListings(undefined, page - 1, PAGE_SIZE)
        .then((res) => {
          if (!cancelled) setListingResult({ key, page: res });
        })
        .catch(() => {
          if (!cancelled) setListingResult({ key, page: null });
        });
    }
    return () => {
      cancelled = true;
    };
  }, [tab, page, requestKey]);

  function updateQuery(next: { tab?: BidTab; page?: number }) {
    const q = new URLSearchParams(searchParams.toString());
    if (next.tab !== undefined) {
      if (next.tab === "listing") q.set("bidTab", "listing");
      else q.delete("bidTab");
    }
    if (next.page !== undefined) {
      if (next.page > 1) q.set("bidPage", String(next.page));
      else q.delete("bidPage");
    }
    const qs = q.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const current =
    tab === "buyOffer"
      ? buyOfferResult?.key === requestKey
        ? buyOfferResult
        : null
      : listingResult?.key === requestKey
        ? listingResult
        : null;
  const isLoading = current === null;
  const isError = current !== null && current.page === null;
  const totalPages = current?.page?.totalPages ?? 0;

  return (
    <section className="mt-3 rounded-[18px] border border-[#EDEDF0] bg-white px-8 py-7 shadow-card">
      <h2 className="mb-4 text-[17px] font-extrabold">입찰</h2>

      <div className="mb-3 flex gap-1 border-b border-[#EDEDF0]">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => updateQuery({ tab: t.key, page: 1 })}
            className={
              tab === t.key
                ? "border-b-2 border-primary px-4 py-2 text-[14px] font-extrabold text-primary"
                : "px-4 py-2 text-[14px] font-semibold text-[#8A8A92] hover:text-[#4B4B52]"
            }
          >
            {t.label}
            {counts[t.key] !== null && (
              <span className="ml-1.5 text-[12.5px] font-bold">{counts[t.key]}</span>
            )}
          </button>
        ))}
      </div>

      {isLoading && <p className="py-10 text-center text-[13.5px] text-[#8A8A92]">불러오는 중…</p>}

      {isError && (
        <p className="py-10 text-center text-[13.5px] text-[#C21414]">
          목록을 불러오지 못했습니다.
        </p>
      )}

      {!isLoading && !isError && current?.page?.content.length === 0 && (
        <div className="py-9 text-center">
          <p className="mb-3 text-[13.5px] text-[#8A8A92]">
            {tab === "buyOffer" ? "등록한 구매입찰이 없어요." : "등록한 판매 매물이 없어요."}
          </p>
          <Link
            href={tab === "buyOffer" ? "/search" : "/listings/new"}
            className="inline-block rounded-[10px] border-2 border-primary-dark bg-primary px-[18px] py-[9px] text-[13.5px] font-bold text-white hover:bg-[#D91212] hover:text-white"
          >
            {tab === "buyOffer" ? "마켓 둘러보기" : "상품 등록하기"}
          </Link>
        </div>
      )}

      {!isLoading && !isError && tab === "buyOffer" && buyOfferResult?.page && buyOfferResult.page.content.length > 0 && (
        <ul className="flex flex-col gap-2">
          {buyOfferResult.page.content.map((b) => (
            <li key={b.buyOfferId}>
              <Link
                href={`/cards/${b.cardId}`}
                className="flex items-center gap-3 rounded-[10px] border border-[#EDEDF0] p-3 hover:bg-[#FAFAFB]"
              >
                <div className="relative h-14 w-10 flex-shrink-0 overflow-hidden rounded-[7px] bg-[#F2F2F5]">
                  <CardImage src={b.cardImageUrl ?? undefined} alt={b.cardName ?? "카드"} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-bold text-[#3A3A42]">
                    {b.cardName ?? "알 수 없는 카드"}
                  </p>
                  <p className="text-[12px] text-[#8A8A92]">
                    {b.price.toLocaleString("ko-KR")}원 · {formatDateTime(b.createdAt)}
                  </p>
                </div>
                <span
                  className={`flex-none rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    BUY_OFFER_STATUS_TONE[b.status] ?? "bg-[#EEF0F2] text-[#9A9AA2]"
                  }`}
                >
                  {BUY_OFFER_STATUS_LABEL[b.status] ?? b.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!isLoading && !isError && tab === "listing" && listingResult?.page && listingResult.page.content.length > 0 && (
        <ul className="flex flex-col gap-2">
          {listingResult.page.content.map((l) => (
            <li key={l.id}>
              <Link
                href={`/cards/${l.cardId}`}
                className="flex items-center justify-between gap-3 rounded-[10px] border border-[#EDEDF0] p-3 hover:bg-[#FAFAFB]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-bold text-[#3A3A42]">
                    {l.cardName ?? "알 수 없는 카드"}
                  </p>
                  <p className="text-[12px] text-[#8A8A92]">
                    {l.price.toLocaleString("ko-KR")}원 · {formatDateTime(l.createdAt)}
                  </p>
                </div>
                <span
                  className={`flex-none rounded-full px-2.5 py-1 text-[11px] font-bold ${LISTING_STATUS_TONE[l.status]}`}
                >
                  {LISTING_STATUS_LABEL[l.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!isLoading && !isError && totalPages > 1 && (
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
