interface PaginationProps {
  page: number; // 1-based
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

// MyTradesSection.tsx/app/notifications/page.tsx가 쓰던 단순 prev/next 스타일 — 개인 활동
// 피드(내 거래 내역, 알림)처럼 "임의 페이지로 점프"가 아니라 순서대로 훑어보는 화면에 맞는다.
// 카드 검색(app/search/SearchResultsView.tsx)은 카탈로그 탐색이라 번호를 나열하는 방식을 쓴다
// (getPageBlock 옆 주석 참고) — 화면 성격이 달라 이 컴포넌트로 통합하지 않는다.
export default function Pagination({ page, totalPages, onPageChange, className }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className={className ?? "mt-6 flex items-center justify-center gap-5 text-[13px]"}>
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
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
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="text-[#4B4B52] disabled:text-[#C9C9CF]"
      >
        다음 ›
      </button>
    </div>
  );
}
