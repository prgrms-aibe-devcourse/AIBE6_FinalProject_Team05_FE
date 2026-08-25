"use client";

import Link from "next/link";

// 판매 등록 완료 직후 보여주는 안내 - BuyOfferCompletedNotice와 동일한 로직/스타일을 그대로 따른다.
// 카드 상세로 곧바로 이동시키는 대신, 방금 등록한 매물을 마이페이지에서 바로 확인할 수 있게 유도한다.
export default function ListingCompletedNotice({ cardId }: { cardId: number }) {
  return (
    <>
      <p className="mb-6 text-[18px] font-extrabold">등록이 완료되었습니다</p>
      <Link
        href="/mypage?bidTab=listing"
        className="inline-block w-full rounded-[11px] border-2 border-primary-dark bg-primary py-3 text-[14.5px] font-bold text-white shadow-tactile-sm hover:text-white"
      >
        내 판매 등록 보러가기
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
