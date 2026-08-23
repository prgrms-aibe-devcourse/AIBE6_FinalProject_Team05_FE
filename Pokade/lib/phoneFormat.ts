// 숫자만 입력해도(예: 01012345678) 하이픈을 자동으로 넣어준다(예: 010-1234-5678).
// 서울 지역번호(02, 2자리)만 예외로 두고 그 외에는 3자리 국번(휴대전화/그 외 지역번호 공통)으로 취급한다.
export function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  if (digits.length < 4) return digits;

  if (digits.startsWith("02")) {
    if (digits.length < 6) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length < 10) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    }
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  if (digits.length < 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length < 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}
