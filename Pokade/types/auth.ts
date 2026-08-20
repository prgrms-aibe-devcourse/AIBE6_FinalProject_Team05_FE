export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
}

export type UserStatus = "PENDING" | "ACTIVE" | "WITHDRAWAL_PENDING" | "SUSPENDED" | "DELETED";
export type UserRole = "USER" | "ADMIN";

export interface MyInfo {
  userId: number;
  email: string;
  nickname: string;
  role: UserRole;
  status: UserStatus;
  profileImageUrl: string | null; // 서버 상대 경로 — profileImageSrc()로 변환해서 사용
  pointBalance: number;
  provider: "LOCAL" | "GOOGLE" | "KAKAO";
  withdrawalRequestedAt: string | null;
}

export interface SignupRequest {
  email: string;
  password: string;
  nickname: string;
}

export interface EmailSendRequest {
  email: string;
}

export interface EmailVerifyRequest {
  email: string;
  code: string;
}

export interface PasswordResetSendRequest {
  email: string;
}

export interface PasswordResetConfirmRequest {
  email: string;
  code: string;
  newPassword: string;
}

export interface NicknameUpdateRequest {
  nickname: string;
}

export interface PasswordUpdateRequest {
  currentPassword: string;
  newPassword: string;
}

export interface OAuth2RegisterRequest {
  ticket: string;
  nickname: string;
  termsAgreed: boolean;
}

export interface WithdrawalRequest {
  password?: string; // LOCAL 계정용
  code?: string; // 소셜 계정용 이메일 인증코드
}
