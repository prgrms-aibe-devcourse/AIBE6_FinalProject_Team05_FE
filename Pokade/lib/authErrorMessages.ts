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
  LOGIN_FAILED:
    "이메일 또는 비밀번호가 일치하지 않습니다.\n소셜 로그인으로 가입하셨다면 아래 소셜 버튼으로 로그인해 주세요.",
  USER_NOT_FOUND: "가입되지 않은 이메일입니다.",
  PASSWORD_CHANGE_NOT_ALLOWED: "소셜 로그인 계정은 비밀번호를 재설정할 수 없습니다.",
  NICKNAME_CHANGE_LIMITED: "닉네임은 마지막 변경 후 30일이 지나야 다시 변경할 수 있습니다.",
  INVALID_CURRENT_PASSWORD: "현재 비밀번호가 일치하지 않습니다.",
  WITHDRAWAL_NOT_ALLOWED: "탈퇴할 수 없는 계정 상태입니다.",
  NOT_WITHDRAWAL_PENDING: "탈퇴 진행 중인 상태가 아닙니다.",
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

// 소셜 로그인 실패 시 BE가 /login?error=... 로 붙여 보내는 코드 → 사용자 메시지.
// 위 AUTH_ERROR_MESSAGES는 ApiError.code(대문자)를 다루므로 출처가 달라 분리해 둔다.
const OAUTH_REDIRECT_MESSAGES: Record<string, string> = {
  email_required:
    "소셜 계정에서 이메일을 받지 못했습니다. 이메일 제공에 동의한 뒤 다시 시도해 주세요.",
  unsupported_provider: "지원하지 않는 소셜 로그인입니다.",
  login_failed: "로그인할 수 없는 계정입니다. 이메일 인증을 완료했는지 확인해 주세요.",
  account_suspended: "정지된 계정입니다. 고객센터에 문의해 주세요.",
  access_denied: "소셜 로그인을 취소했습니다.",
  oauth2_failed: "소셜 로그인에 실패했습니다. 다시 시도해 주세요.",
};

const OAUTH_PROVIDER_LABELS: Record<string, string> = {
  LOCAL: "이메일",
  GOOGLE: "Google",
  KAKAO: "카카오",
};

// 충돌은 이메일 가입뿐 아니라 다른 소셜로 가입한 경우도 포함한다(provider 불일치).
// BE가 provider를 함께 넘기면 구체적으로, 없으면 일반 문구로 안내한다.
function emailConflictMessage(provider: string | null): string {
  const label = provider ? OAUTH_PROVIDER_LABELS[provider] : undefined;
  if (label === "이메일") {
    return "이미 이메일로 가입된 계정입니다. 이메일과 비밀번호로 로그인해 주세요.";
  }
  if (label) {
    return `이미 ${label}로 가입된 계정입니다. ${label} 버튼으로 로그인해 주세요.`;
  }
  return "이미 다른 방법으로 가입된 이메일입니다. 기존 가입 방식으로 로그인해 주세요.";
}

// 미매핑 코드는 일반 문구로 흡수한다 - 실패 핸들러가 Spring 에러 코드를 그대로 붙이는
// 경로가 있어 FE가 값의 종류를 전부 알 수 없다.
export function oauthRedirectErrorMessage(
  code: string | null,
  provider: string | null = null,
): string | null {
  if (!code) return null;
  if (code === "email_conflict") return emailConflictMessage(provider);
  return OAUTH_REDIRECT_MESSAGES[code] ?? "소셜 로그인에 실패했습니다. 다시 시도해 주세요.";
}
