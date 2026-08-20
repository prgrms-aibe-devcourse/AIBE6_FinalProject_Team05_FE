import { UserRole, UserStatus } from "@/types/auth";

export interface AdminUserResponse {
  userId: number;
  email: string;
  nickname: string;
  role: UserRole;
  status: UserStatus;
  provider: "LOCAL" | "GOOGLE" | "KAKAO";
  joinedAt: string;
}
