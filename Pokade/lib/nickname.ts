// 닉네임 입력 규칙 - BE의 @Size(2, 20) + @Pattern("^\\S+$")과 같은 기준이다.
// 회원가입·소셜 가입·닉네임 변경 세 화면이 각자 검사하다 보니 규칙이 어긋나 있었고
// (소셜 가입은 trim조차 하지 않아 공백만 넣어도 제출이 열렸다) 여기로 모은다.
//
// 공백을 잘라내지 않고 거부하는 이유는 두 가지다.
// 1. 닉네임 중복 검사가 입력을 원문 그대로 비교하므로 "홍길동"과 "홍 길동"이
//    서로 다른 계정으로 공존할 수 있다. 앞뒤만 잘라내면 중간 공백이 그대로 남는다.
// 2. 조용히 고쳐서 보내면 사용자가 입력한 것과 다른 이름이 등록된다. BE도 같은 이유로
//    정규화가 아니라 400으로 거부한다.
export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 20;

// 입력이 규칙에 맞으면 null, 어긋나면 사용자에게 보여줄 문구를 돌려준다.
export function nicknameError(value: string): string | null {
  if (value.length === 0) {
    return "닉네임을 입력해 주세요.";
  }
  if (/\s/.test(value)) {
    return "닉네임에는 공백을 사용할 수 없습니다.";
  }
  if (value.length < NICKNAME_MIN_LENGTH || value.length > NICKNAME_MAX_LENGTH) {
    return `닉네임은 ${NICKNAME_MIN_LENGTH}~${NICKNAME_MAX_LENGTH}자로 입력해 주세요.`;
  }
  return null;
}

// 제출 버튼 활성화처럼 문구가 필요 없는 곳에서 쓴다.
export function isValidNickname(value: string): boolean {
  return nicknameError(value) === null;
}
