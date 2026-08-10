export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
}

export interface MyInfo {
  userId: number;
  email: string;
  nickname: string;
  role: "USER" | "ADMIN";
  status: "PENDING" | "ACTIVE" | "SUSPENDED" | "DELETED";
  profileImageUrl: string | null;
  pointBalance: number;
  provider: "LOCAL" | "GOOGLE" | "KAKAO";
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

export interface OAuth2RegisterRequest {
  ticket: string;
  nickname: string;
  termsAgreed: boolean;
}
