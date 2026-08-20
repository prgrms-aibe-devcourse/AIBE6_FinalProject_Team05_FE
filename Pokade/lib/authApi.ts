import { apiGet, apiPatch, apiPost, apiPut, apiDelete } from "@/lib/apiClient";
import {
  LoginRequest,
  LoginResponse,
  MyInfo,
  WithdrawalRequest,
  SignupRequest,
  EmailSendRequest,
  EmailVerifyRequest,
  PasswordResetSendRequest,
  PasswordResetConfirmRequest,
  NicknameUpdateRequest,
  PasswordUpdateRequest,
  OAuth2RegisterRequest,
} from "@/types/auth";

// POST /api/auth/login — accessToken 발급 + refresh 쿠키 세팅
export function login(body: LoginRequest): Promise<LoginResponse> {
  return apiPost<LoginResponse>("/api/auth/login", body);
}

// POST /api/auth/logout — refresh 쿠키 무효화 (본문 없음)
export function logout(): Promise<void> {
  return apiPost<void>("/api/auth/logout");
}

// GET /api/users/me — 로그인 사용자 프로필
export function getMyInfo(): Promise<MyInfo> {
  return apiGet<MyInfo>("/api/users/me");
}

// POST /api/users/me/withdrawal/send-code - 소셜 탈퇴용 인증코드 발송(쿨다운 60s)
export function sendWithdrawalCode(): Promise<void> {
  return apiPost<void>("/api/users/me/withdrawal/send-code");
}

// DELETE /api/users/me — 회원 탈퇴 신청(LOCAL: password / 소셜: code) → WITHDRAWAL_PENDING(7일 유예)
export function requestWithdrawal(body: WithdrawalRequest): Promise<void> {
  return apiDelete("/api/users/me", body);
}

// POST /api/users/me/withdrawal/cancel — 탈퇴 신청 철회 → ACTIVE 복구
export function cancelWithdrawal(): Promise<void> {
  return apiPost<void>("/api/users/me/withdrawal/cancel");
}
// POST /api/auth/signup — 계정 생성(status=PENDING). 코드 발송은 별도(sendEmailCode).
export function signup(body: SignupRequest): Promise<void> {
  return apiPost<void>("/api/auth/signup", body);
}

// POST /api/auth/email/send — 6자리 인증코드 발송(쿨다운 60s)
export function sendEmailCode(email: string): Promise<void> {
  return apiPost<void>("/api/auth/email/send", { email } satisfies EmailSendRequest);
}

// POST /api/auth/email/verify — 코드 검증 → PENDING→ACTIVE
export function verifyEmail(email: string, code: string): Promise<void> {
  return apiPost<void>("/api/auth/email/verify", { email, code } satisfies EmailVerifyRequest);
}

// POST /api/auth/password/reset/send — 재설정 코드 발송(쿨다운 60s)
export function sendPasswordResetCode(email: string): Promise<void> {
  return apiPost<void>("/api/auth/password/reset/send", {
    email,
  } satisfies PasswordResetSendRequest);
}

// POST /api/auth/password/reset/confirm — 코드 검증 + 새 비밀번호 설정
export function confirmPasswordReset(
  email: string,
  code: string,
  newPassword: string,
): Promise<void> {
  return apiPost<void>("/api/auth/password/reset/confirm", {
    email,
    code,
    newPassword,
  } satisfies PasswordResetConfirmRequest);
}

// PATCH /api/users/me - 닉네임 변경 (30일 쿨다운, 중복 검사)
export function updateNickname(nickname: string): Promise<void> {
  return apiPatch<void>("/api/users/me", { nickname } satisfies NicknameUpdateRequest);
}

// PUT /api/users/me/password - 비밀번호 변경 (LOCAL 계정, 현재 비번 확인)
export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return apiPut<void>("/api/users/me/password", {
    currentPassword,
    newPassword,
  } satisfies PasswordUpdateRequest);
}

// POST /api/auth/oauth2/register — 소셜 신규가입(티켓+닉네임+약관) → accessToken + refresh 쿠키
export function oauth2Register(body: OAuth2RegisterRequest): Promise<LoginResponse> {
  return apiPost<LoginResponse>("/api/auth/oauth2/register", body);
}

// PATCH /api/users/me/agreements/marketing — 마케팅 수신 동의 변경. 철회도 이력으로 남는다.
export function changeMarketingAgreement(agreed: boolean): Promise<void> {
  return apiPatch<void>("/api/users/me/agreements/marketing", { agreed });
}
