"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import CardImage from "@/components/CardImage";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { ApiError } from "@/lib/apiClient";
import { fetchPriceSummaries, fetchPriceSummary } from "@/lib/cardApi";
import { fetchMyListing, updateListingPrice } from "@/lib/listingApi";
import { GRADE_LABELS, GradeKey, MyListingResponse } from "@/types/price";

type LoadState = "loading" | "error" | "ready";

// 입력 가격이 참고 시세 대비 이 비율 이상 높으면 등록 자체를 막는다 - /listings/new,
// /buy-offers/new와 동일한 정책/값.
const PRICE_OUTLIER_THRESHOLD = 0.3;

// 마이페이지 "입찰" 목록(판매 등록 탭)에서 항목을 클릭했을 때 보여주는 화면 - 카드 상세로 보내는
// 대신, 등록했던 주문서를 다시 보여준다. ACTIVE(판매중)일 때만 판매 가격을 수정할 수 있고,
// 정산계좌/반송주소는 등록 시점 값을 읽기 전용으로만 보여준다(BE에 수정 API가 없음).
export default function MyListingDetailPage() {
  const status = useRequireAuth();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const listingId = Number(id);

  const [listing, setListing] = useState<MyListingResponse | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  const [priceInput, setPriceInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 이 매물의 등급 기준 참고 시세 - 등급이 있으면 그 등급의 최저 매물가(없으면 최근 체결가),
  // 등급이 없는(RAW) 매물이면 등급 무관 전체 최저가를 쓴다. 등급은 이 화면에서 바꿀 수 없으므로
  // /listings/new처럼 등급별로 나눠 관리할 필요 없이 값 하나로 충분하다.
  const [referencePrice, setReferencePrice] = useState<number | null>(null);
  const [referenceIsRecentTrade, setReferenceIsRecentTrade] = useState(false);
  const [referenceLoading, setReferenceLoading] = useState(false);

  useEffect(() => {
    if (status !== "authenticated" || !Number.isFinite(listingId)) return;
    let cancelled = false;
    fetchMyListing(listingId)
      .then((res) => {
        if (cancelled) return;
        setListing(res);
        setPriceInput(String(res.price));
        setLoadState("ready");
      })
      .catch(() => {
        if (!cancelled) setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [status, listingId]);

  useEffect(() => {
    if (!listing) return;
    let cancelled = false;
    // 비동기 페치 수명주기 표시라 파생 상태로 대체할 수 없음 - listings/new의 동일 패턴과 같은 이유.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReferenceLoading(true);
    const request = listing.grade
      ? fetchPriceSummaries([listing.cardId], {
          grade: listing.grade,
          includeRecentTradePrice: true,
        }).then((summaries) => {
          const summary = summaries.get(listing.cardId);
          return {
            price: summary?.buyPrice ?? summary?.recentTradePrice ?? null,
            isRecentTrade: summary?.buyPrice == null && summary?.recentTradePrice != null,
          };
        })
      : fetchPriceSummary(listing.cardId, listing.variantId ?? undefined).then((summary) => ({
          price: summary.buyPrice,
          isRecentTrade: false,
        }));

    request
      .then((result) => {
        if (cancelled) return;
        setReferencePrice(result.price);
        setReferenceIsRecentTrade(result.isRecentTrade);
      })
      .catch(() => {
        if (cancelled) return;
        setReferencePrice(null);
        setReferenceIsRecentTrade(false);
      })
      .finally(() => {
        if (!cancelled) setReferenceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [listing]);

  if (status !== "authenticated") return null;

  if (!Number.isFinite(listingId)) {
    return (
      <main className="main-content flex items-center justify-center bg-neutral px-10 py-14">
        <p className="text-[14px] font-semibold text-[#8A8A92]">잘못된 접근입니다.</p>
      </main>
    );
  }

  if (loadState === "loading") {
    return (
      <main className="main-content flex items-center justify-center bg-neutral px-10 py-14">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#E7E7EB] border-t-primary" />
      </main>
    );
  }

  if (loadState === "error" || !listing) {
    return (
      <main className="main-content flex items-center justify-center bg-neutral px-10 py-14">
        <p className="text-[14px] font-semibold text-[#8A8A92]">주문서를 불러오지 못했습니다.</p>
      </main>
    );
  }

  const isEditable = listing.status === "ACTIVE";
  const gradeKey: GradeKey = listing.grade ?? "RAW";
  const parsedPrice = Number(priceInput.replace(/[^0-9]/g, ""));
  const referenceLabel = listing.grade
    ? referenceIsRecentTrade
      ? `${GRADE_LABELS[gradeKey]} 등급 최근 체결가`
      : `현재 ${GRADE_LABELS[gradeKey]} 등급 최저 시세`
    : "현재 최저 시세";

  let priceOutlierWarning: string | null = null;
  if (
    priceInput &&
    Number.isFinite(parsedPrice) &&
    parsedPrice > 0 &&
    referencePrice != null &&
    referencePrice > 0
  ) {
    const diffRatio = (parsedPrice - referencePrice) / referencePrice;
    if (diffRatio >= PRICE_OUTLIER_THRESHOLD) {
      priceOutlierWarning = "입력하신 가격이 현재 최저 시세보다 많이 높습니다. 다시 한번 확인해 주세요.";
    } else if (diffRatio <= -PRICE_OUTLIER_THRESHOLD) {
      priceOutlierWarning = "입력하신 가격이 현재 최저 시세보다 많이 낮습니다. 다시 한번 확인해 주세요.";
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!priceInput.trim() || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setError("올바른 가격을 입력해 주세요.");
      return;
    }
    if (referencePrice != null && referencePrice > 0) {
      const diffRatio = (parsedPrice - referencePrice) / referencePrice;
      if (diffRatio >= PRICE_OUTLIER_THRESHOLD) {
        setError("입력하신 가격이 현재 최저 시세보다 많이 높습니다. 가격을 다시 확인해 주세요.");
        return;
      }
    }

    setSaving(true);
    try {
      await updateListingPrice(listingId, { price: parsedPrice });
      // 수정 완료 후엔 이 화면에 머물 이유가 없다 - 원래 있던 마이페이지(입찰 탭)로 바로 돌려보낸다.
      router.push("/mypage?bidTab=listing");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "판매 가격 수정에 실패했습니다.");
      setSaving(false);
    }
  };

  const inputCls =
    "w-full rounded-[11px] border border-[#DDDDE3] px-3.5 py-3 text-[14.5px] text-ink outline-none disabled:cursor-not-allowed disabled:bg-neutral disabled:text-[#9A9AA2]";
  const labelCls = "mb-[7px] block text-[13px] font-bold text-[#4B4B52]";
  const sectionCls = "rounded-[18px] border border-[#EDEDF0] bg-white px-[26px] py-7 shadow-card";
  const sectionTitleCls = "mb-4 text-[15px] font-extrabold";

  return (
    <main className="main-content bg-neutral px-10 pb-32 pt-14">
      <div className="mx-auto w-full max-w-[560px]">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-[20px] font-extrabold tracking-[-0.5px]">주문서</h1>
          <button
            type="button"
            onClick={() => router.back()}
            className="text-[13px] font-semibold text-[#8A8A92] hover:text-primary"
          >
            돌아가기
          </button>
        </div>

        <form id="listing-detail-form" onSubmit={handleSave} className="space-y-6">
          {/* ① 판매 상품 */}
          <section className={sectionCls}>
            <h2 className={sectionTitleCls}>판매 상품</h2>
            <div className="flex items-center gap-3.5">
              <div className="relative h-28 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-[#F2F2F5]">
                <CardImage
                  src={listing.cardImageUrl ?? undefined}
                  alt={listing.cardNameKo ?? listing.cardName ?? "카드"}
                  label="카드"
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-[14.5px] font-bold text-ink">
                  {listing.cardNameKo ?? listing.cardName ?? "알 수 없는 카드"}
                </p>
                <p className="text-[13px] font-bold text-ink">{GRADE_LABELS[gradeKey]}</p>
              </div>
            </div>
          </section>

          {/* ② 판매 가격 */}
          <section className={sectionCls}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] font-extrabold">판매 가격</h2>
              {!isEditable && (
                <span className="text-[12px] font-semibold text-[#9A9AA2]">
                  거래가 진행되어 수정할 수 없어요
                </span>
              )}
            </div>

            <div className="mb-[7px] flex items-center justify-between">
              <label htmlFor="listing-price" className={labelCls}>
                판매 희망가
              </label>
              <span className="text-[12px] font-semibold text-[#8A8A92]">
                {referenceLoading
                  ? "시세 조회 중..."
                  : referencePrice != null
                    ? `${referenceLabel} ${referencePrice.toLocaleString("ko-KR")}원`
                    : "시세 정보 없음"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="listing-price"
                type="text"
                inputMode="numeric"
                value={priceInput}
                disabled={!isEditable}
                onChange={(e) => setPriceInput(e.target.value.replace(/[^0-9]/g, ""))}
                className={inputCls}
              />
              <span className="shrink-0 text-[14px] font-bold text-[#4B4B52]">원</span>
            </div>
            {isEditable && priceOutlierWarning && (
              <p className="mt-1.5 text-[12px] font-semibold text-[#C97A00]">
                {priceOutlierWarning}
              </p>
            )}
          </section>

          {/* ③ 판매 정산 계좌 / 반송 주소 */}
          <section className={sectionCls}>
            <h2 className={sectionTitleCls}>판매 정산 계좌</h2>
            <dl className="space-y-2.5">
              <div className="flex items-center justify-between">
                <dt className="text-[13px] font-semibold text-[#8A8A92]">은행</dt>
                <dd className="text-[14px] font-bold">{listing.settlementBankName ?? "-"}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[13px] font-semibold text-[#8A8A92]">계좌번호</dt>
                <dd className="text-[14px] font-bold">{listing.settlementAccountNumber ?? "-"}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[13px] font-semibold text-[#8A8A92]">예금주</dt>
                <dd className="text-[14px] font-bold">{listing.settlementAccountHolder ?? "-"}</dd>
              </div>
            </dl>

            <div className="my-5 h-px bg-[#EDEDF0]" />

            <h2 className={sectionTitleCls}>반송 주소</h2>
            <dl className="space-y-2.5">
              <div className="flex items-center justify-between">
                <dt className="text-[13px] font-semibold text-[#8A8A92]">받는사람</dt>
                <dd className="text-[14px] font-bold">{listing.returnRecipientName ?? "-"}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[13px] font-semibold text-[#8A8A92]">전화번호</dt>
                <dd className="text-[14px] font-bold">{listing.returnRecipientPhone ?? "-"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="shrink-0 text-[13px] font-semibold text-[#8A8A92]">주소</dt>
                <dd className="truncate text-right text-[14px] font-bold">
                  {listing.returnAddress ?? "-"}
                </dd>
              </div>
            </dl>
          </section>
        </form>
      </div>

      {isEditable && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-[#EDEDF0] bg-white px-10 py-4">
          <div className="mx-auto w-full max-w-[560px]">
            {error && <p className="mb-2.5 text-[12.5px] font-semibold text-primary">{error}</p>}
            <button
              type="submit"
              form="listing-detail-form"
              disabled={saving}
              className="w-full rounded-[11px] border-2 border-primary-dark bg-primary py-3.5 text-[15.5px] font-bold text-white shadow-tactile transition active:translate-y-0.5 active:shadow-tactile-active disabled:opacity-60"
            >
              {saving ? "저장 중..." : "수정 완료"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
