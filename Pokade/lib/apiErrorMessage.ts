// BE 전역 예외 핸들러(GlobalExceptionHandler)는 bean validation 실패를
// "필드명: 메시지" 형태로 합쳐 내려준다 — 예: "targetBuyPrice: 목표가는 1억원을 초과할 수 없습니다."
// 사용자에게 targetBuyPrice 같은 필드명은 아무 의미가 없어 앞부분만 걷어낸다(#238).
//
// BE 공용 파일을 고치지 않고 FE에서 다듬는 이유: 핸들러는 여러 도메인이 함께 쓰는 파일이라
// 응답 형식을 바꾸면 다른 화면·다른 담당자 영역까지 영향이 간다. 표시 직전에 손보는 편이
// 범위가 좁고 되돌리기도 쉽다.
//
// 이 규칙이 워치리스트 전용이 아니라 lib에 있는 이유: 원인이 BE 전역 핸들러라 bean validation을
// 쓰는 다른 폼(매물 등록, 문의 작성 등)도 같은 형태를 받게 된다. 두 번째 사용처가 생기면
// 그대로 import해서 쓰면 된다.
//
// 앞이 ASCII 식별자 + 콜론 + 공백일 때만 지운다:
//   - 한글로 시작하는 메시지("목표 구매가는 …")는 애초에 매칭되지 않아 안전하다
//   - 콜론 뒤 공백을 요구하므로 "https://…"처럼 공백 없는 콜론은 건드리지 않는다
const FIELD_PREFIX = /^[A-Za-z_][A-Za-z0-9_]*:\s+/;

export function stripFieldPrefix(message: string): string {
  return message.replace(FIELD_PREFIX, "");
}
