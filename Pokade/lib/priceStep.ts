// 가격 자릿수에 따라 입력 단위를 다르게 강제한다 - 100~999원대는 10원 단위, 1,000원대는 100원
// 단위, 10,000원대는 1,000원 단위, 100,000원대는 10,000원 단위... 식으로 자릿수가 하나 오를
// 때마다 단위도 10배씩 커지되, 100만원부터는 5만원 단위로 고정한다(그 이상 고가에서도 5만원보다
// 촘촘한 단위를 요구하지 않는다).
// Math.log10 기반 계산은 부동소수점 오차로 정확히 10의 거듭제곱에서 자릿수가 하나 낮게 나올 수
// 있어(예: log10(1000) ≈ 2.9999999998) 반복문으로 안전하게 계산한다.
const MAX_STEP = 50_000;

export function getPriceStep(price: number): number {
  if (price < 100) return 1;

  let threshold = 100;
  let step = 10;
  while (price >= threshold * 10 && step < MAX_STEP) {
    threshold *= 10;
    step *= 10;
  }
  return Math.min(step, MAX_STEP);
}
