// 폼 라벨 옆에 붙는 필수 입력 표시 - 주문서/구매·판매 입찰 등록 화면들이 공통으로 쓴다.
// 별표(*)는 시각적 표시일 뿐이라 aria-hidden으로 숨기고, sr-only 텍스트로 스크린리더에도
// "필수" 임을 전달한다.
export default function RequiredMark() {
  return (
    <span className="ml-0.5 text-primary">
      <span aria-hidden="true">*</span>
      <span className="sr-only"> (필수)</span>
    </span>
  );
}
