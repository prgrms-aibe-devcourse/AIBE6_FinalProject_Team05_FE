// 폼 라벨 옆에 붙는 필수 입력 표시 - 주문서/구매·판매 입찰 등록 화면들이 공통으로 쓴다.
export default function RequiredMark() {
  return (
    <span className="ml-0.5 text-primary" aria-hidden="true">
      *
    </span>
  );
}
