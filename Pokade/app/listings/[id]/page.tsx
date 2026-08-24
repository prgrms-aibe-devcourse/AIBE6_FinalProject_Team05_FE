"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AddressSearchField from "@/components/AddressSearchField";
import BankSelector from "@/components/BankSelector";
import CardImage from "@/components/CardImage";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { ApiError } from "@/lib/apiClient";
import { fetchPriceSummaries, fetchPriceSummary } from "@/lib/cardApi";
import { fetchMyListing, updateListing } from "@/lib/listingApi";
import { formatPhoneNumber } from "@/lib/phoneFormat";
import { resolveGradeReferencePrice } from "@/lib/priceDisplay";
import { GRADE_LABELS, GradeKey, MyListingResponse } from "@/types/price";

type LoadState = "loading" | "error" | "ready";

// 입력 가격이 참고 시세 대비 이 비율 이상 높으면 등록 자체를 막는다 - /listings/new,
// /buy-offers/new와 동일한 정책/값.
const PRICE_OUTLIER_THRESHOLD = 0.3;

// 마이페이지 "입찰" 목록(판매 등록 탭)에서 항목을 클릭했을 때 보여주는 화면 - 카드 상세로 보내는
// 대신, 등록했던 주문서를 다시 보여준다. ACTIVE(판매중)일 때만 판매 가격과 정산계좌/반송주소를
// 수정할 수 있다.
export default function MyListingDetailPage() {
  const status = useRequireAuth();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const listingId = Number(id);

  const [listing, setListing] = useState<MyListingResponse | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  const [priceInput, setPriceInput] = useState("");
  const [settlementBankName, setSettlementBankName] = useState("");
  const [settlementAccountNumber, setSettlementAccountNumber] = useState("");
  const [settlementAccountHolder, setSettlementAccountHolder] = useState("");
  const [returnRecipientName, setReturnRecipientName] = useState("");
  const [returnRecipientPhone, setReturnRecipientPhone] = useState("");
  const [returnAddress, setReturnAddress] = useState("");
  // AddressSearchField는 기존 주소를 미리 채울 수 없는 컴포넌트라, 처음엔 등록된 주소를 읽기
  // 전용으로 보여주고 "변경"을 눌렀을 때만 검색 필드로 바꾼다(buy-offers/[id]와 동일한 패턴).
  const [editingAddress, setEditingAddress] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 이 매물의 등급 기준 참고 시세 - 등급이 있으면 그 등급의 최저 매물가 → 최근 체결가 → 마켓
  // 검색 화면과 동일한 참고 시세(marketPrice, KRW 환산) 순으로, 등급이 없는(RAW) 매물이면 등급
  // 무관 전체 최저가를 쓴다. 등급은 이 화면에서 바꿀 수 없으므로 /listings/new처럼 등급별로
  // 나눠 관리할 필요 없이 값 하나로 충분하다.
  const [referencePrice, setReferencePrice] = useState<number | null>(null);
  const [referenceTier, setReferenceTier] = useState<"primary" | "recentTrade" | "market" | null>(null);
  // 이상치 경고/차단 계산 전용 - referencePrice와 달리 마켓 참고가(market) 단계는 절대 포함하지
  // 않는다(KRW 환산이 고정 근사 환율이라 잘못된 기준으로 등록을 막을 수 있어 정보 표시 전용으로만 씀).
  const [outlierReferencePrice, setOutlierReferencePrice] = useState<number | null>(null);
  const [referenceLoading, setReferenceLoading] = useState(false);

  useEffect(() => {
    if (status !== "authenticated" || !Number.isFinite(listingId)) return;
    let cancelled = false;
    fetchMyListing(listingId)
      .then((res) => {
        if (cancelled) return;
        setListing(res);
        setPriceInput(String(res.price));
        setSettlementBankName(res.settlementBankName ?? "");
        setSettlementAccountNumber(res.settlementAccountNumber ?? "");
        setSettlementAccountHolder(res.settlementAccountHolder ?? "");
        setReturnRecipientName(res.returnRecipientName ?? "");
        setReturnRecipientPhone(res.returnRecipientPhone ?? "");
        setReturnAddress(res.returnAddress ?? "");
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
          const resolved = resolveGradeReferencePrice(summary, "buyPrice");
          return {
            price: resolved?.price ?? null,
            tier: resolved?.tier ?? null,
            outlierPrice: summary?.buyPrice ?? summary?.recentTradePrice ?? null,
          };
        })
      : fetchPriceSummary(listing.cardId, listing.variantId ?? undefined).then((summary) => ({
          price: summary.buyPrice,
          tier: summary.buyPrice != null ? ("primary" as const) : null,
          outlierPrice: summary.buyPrice,
        }));

    request
      .then((result) => {
        if (cancelled) return;
        setReferencePrice(result.price);
        setReferenceTier(result.tier);
        setOutlierReferencePrice(result.outlierPrice);
      })
      .catch(() => {
        if (cancelled) return;
        setReferencePrice(null);
        setReferenceTier(null);
        setOutlierReferencePrice(null);
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
    ? referenceTier === "recentTrade"
      ? `${GRADE_LABELS[gradeKey]} 등급 최근 체결가`
      : referenceTier === "market"
        ? "마켓 참고 시세"
        : `현재 ${GRADE_LABELS[gradeKey]} 등급 최저 시세`
    : "현재 최저 시세";

  let priceOutlierWarning: string | null = null;
  if (
    priceInput &&
    Number.isFinite(parsedPrice) &&
    parsedPrice > 0 &&
    outlierReferencePrice != null &&
    outlierReferencePrice > 0
  ) {
    const diffRatio = (parsedPrice - outlierReferencePrice) / outlierReferencePrice;
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
    if (
      !settlementBankName.trim() ||
      !settlementAccountNumber.trim() ||
      !settlementAccountHolder.trim() ||
      !returnRecipientName.trim() ||
      !returnRecipientPhone.trim() ||
      !returnAddress.trim()
    ) {
      setError("정산계좌/반송주소 항목을 모두 입력해 주세요.");
      return;
    }
    if (outlierReferencePrice != null && outlierReferencePrice > 0) {
      const diffRatio = (parsedPrice - outlierReferencePrice) / outlierReferencePrice;
      if (diffRatio >= PRICE_OUTLIER_THRESHOLD) {
        setError("입력하신 가격이 현재 최저 시세보다 많이 높습니다. 가격을 다시 확인해 주세요.");
        return;
      }
    }

    setSaving(true);
    try {
      await updateListing(listingId, {
        price: parsedPrice,
        settlementBankName: settlementBankName.trim(),
        settlementAccountNumber: settlementAccountNumber.trim(),
        settlementAccountHolder: settlementAccountHolder.trim(),
        returnRecipientName: returnRecipientName.trim(),
        returnRecipientPhone: returnRecipientPhone.trim(),
        returnAddress: returnAddress.trim(),
      });
      // 수정 완료 후엔 이 화면에 머물 이유가 없다 - 원래 있던 마이페이지(입찰 탭)로 바로 돌려보낸다.
      router.push("/mypage?bidTab=listing");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "매물 정보 수정에 실패했습니다.");
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

          {/* ③ 판매 정산 계좌 */}
          <section className={sectionCls}>
            <h2 className={sectionTitleCls}>판매 정산 계좌</h2>

            <label className={labelCls}>은행명</label>
            <BankSelector
              value={settlementBankName}
              onChange={setSettlementBankName}
              inputCls={inputCls}
              disabled={!isEditable}
            />

            <div className="h-4" />

            <label htmlFor="settlement-account-number" className={labelCls}>
              계좌번호
            </label>
            <input
              id="settlement-account-number"
              type="text"
              value={settlementAccountNumber}
              disabled={!isEditable}
              onChange={(e) => setSettlementAccountNumber(e.target.value)}
              placeholder="- 없이 숫자만 입력"
              className={inputCls}
            />

            <div className="h-4" />

            <label htmlFor="settlement-account-holder" className={labelCls}>
              예금주
            </label>
            <input
              id="settlement-account-holder"
              type="text"
              value={settlementAccountHolder}
              disabled={!isEditable}
              onChange={(e) => setSettlementAccountHolder(e.target.value)}
              className={inputCls}
            />
          </section>

          {/* ④ 반송 주소 */}
          <section className={sectionCls}>
            <h2 className={sectionTitleCls}>반송 주소</h2>
            <p className="mb-4 text-[12.5px] text-[#8A8A92]">
              검수 실패 등으로 매물이 반송될 경우 사용됩니다.
            </p>

            <label htmlFor="return-recipient-name" className={labelCls}>
              받는사람 이름
            </label>
            <input
              id="return-recipient-name"
              type="text"
              value={returnRecipientName}
              disabled={!isEditable}
              onChange={(e) => setReturnRecipientName(e.target.value)}
              className={inputCls}
            />

            <div className="h-4" />

            <label htmlFor="return-recipient-phone" className={labelCls}>
              전화번호
            </label>
            <input
              id="return-recipient-phone"
              type="text"
              inputMode="numeric"
              value={returnRecipientPhone}
              disabled={!isEditable}
              onChange={(e) => setReturnRecipientPhone(formatPhoneNumber(e.target.value))}
              placeholder="010-0000-0000"
              className={inputCls}
            />

            <div className="h-4" />

            <label className={labelCls}>주소</label>
            {editingAddress ? (
              <AddressSearchField onChange={setReturnAddress} inputCls={inputCls} />
            ) : (
              <div className="flex items-center gap-2">
                <input type="text" value={returnAddress} disabled className={inputCls} />
                {isEditable && (
                  <button
                    type="button"
                    onClick={() => setEditingAddress(true)}
                    className="shrink-0 rounded-[11px] border border-[#DDDDE3] bg-white px-4 py-3 text-[13px] font-bold text-[#4B4B52] transition hover:border-primary hover:text-primary"
                  >
                    변경
                  </button>
                )}
              </div>
            )}
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
