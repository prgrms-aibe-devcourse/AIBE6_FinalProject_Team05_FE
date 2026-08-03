import { apiGet, apiPost } from "@/lib/apiClient";
import { LoginRequest, LoginResponse, MyInfo } from "@/types/auth";

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
