import { apiGet } from "@/lib/apiClient";
import type { MyProfile, PublicProfile } from "@/types/profile";

// 본인 상세 프로필 조회 (인증 필요)
export function getMyProfile(): Promise<MyProfile> {
  return apiGet<MyProfile>("/api/users/me/profile");
}

// 특정 사용자의 공개 프로필 조회 (비로그인 허용)
export function getPublicProfile(userId: number): Promise<PublicProfile> {
  return apiGet<PublicProfile>(`/api/users/${userId}`);
}
