import { ApiError } from "@/lib/apiClient";

// 인증 관련 에러코드 → 사용자 메시지 (signup/login/verify-email 공용)
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  DUPLICATE_EMAIL: "이미 가입된 이메일입니다.",
  DUPLICATE_NICKNAME: "이미 사용 중인 닉네임입니다.",
  EMAIL_NOT_VERIFIED: "이메일 인증이 완료되지 않았습니다.",
  EMAIL_ALREADY_VERIFIED: "이미 인증이 완료된 계정입니다. 로그인해 주세요.",
  EMAIL_SEND_RATE_LIMITED: "인증 코드는 잠시 후에 다시 요청해 주세요.",
  EMAIL_CODE_MISMATCH: "인증 코드가 일치하지 않습니다.",
  EMAIL_CODE_EXPIRED: "인증 코드가 만료되었습니다. 코드를 재발송해 주세요.",
  EMAIL_VERIFY_ATTEMPT_EXCEEDED: "인증 시도 횟수를 초과했습니다. 코드를 재발송해 주세요.",
  USER_NOT_FOUND: "가입되지 않은 이메일입니다.",
  PASSWORD_CHANGE_NOT_ALLOWED: "소셜 로그인 계정은 비밀번호를 재설정할 수 없습니다.",
  NICKNAME_CHANGE_LIMITED: "닉네임은 마지막 변경 후 30일이 지나야 다시 변경할 수 있습니다.",
  INVALID_CURRENT_PASSWORD: "현재 비밀번호가 일치하지 않습니다.",
};

// ApiError면 코드별 메시지(미매핑은 서버가 준 메시지), 그 외는 fallback
export function authErrorMessage(
  e: unknown,
  fallback = "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
): string {
  if (e instanceof ApiError) {
    return AUTH_ERROR_MESSAGES[e.code] ?? e.message;
  }
  return fallback;
}
