import { apiGet, apiPost } from "@/lib/apiClient";
import {
  LoginRequest,
  LoginResponse,
  MyInfo,
  SignupRequest,
  EmailSendRequest,
  EmailVerifyRequest,
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
