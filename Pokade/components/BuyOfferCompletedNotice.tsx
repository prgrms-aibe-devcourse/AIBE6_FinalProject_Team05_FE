"use client";

import Link from "next/link";

// 구매입찰 등록(결제 승인) 완료 직후 보여주는 안내 - 카드 상세로 곧바로 이동시키는 대신, 방금
// 등록한 입찰을 마이페이지에서 바로 확인할 수 있게 유도한다. 토스 결제 경로(checkout/success)와
// 포인트 전액 결제 경로(new/order, 토스 위젯 없이 바로 승인) 양쪽에서 재사용한다.
export default function BuyOfferCompletedNotice({ cardId }: { cardId: number }) {
  return (
    <>
      <p className="mb-6 text-[18px] font-extrabold">입찰이 완료되었습니다</p>
      <Link
        href="/mypage?bidTab=buyOffer"
        className="inline-block w-full rounded-[11px] border-2 border-primary-dark bg-primary py-3 text-[14.5px] font-bold text-white shadow-tactile-sm hover:text-white"
      >
        내 입찰 내역 보러가기
      </Link>
      <Link
        href={`/cards/${cardId}`}
        className="mt-2.5 inline-block w-full rounded-[11px] border-[1.5px] border-[#DDDDE3] bg-white py-3 text-[14px] font-bold text-[#4B4B52] transition hover:bg-[#F4F4F6]"
      >
        돌아가기
      </Link>
    </>
  );
}
