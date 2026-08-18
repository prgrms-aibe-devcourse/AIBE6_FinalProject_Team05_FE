import { apiDelete, apiGet, apiPostForm } from "@/lib/apiClient";
import type { MyProfile, PublicProfile } from "@/types/profile";

// 본인 상세 프로필 조회 (인증 필요)
export function getMyProfile(): Promise<MyProfile> {
  return apiGet<MyProfile>("/api/users/me/profile");
}

// 특정 사용자의 공개 프로필 조회 (비로그인 허용)
export function getPublicProfile(userId: number): Promise<PublicProfile> {
  return apiGet<PublicProfile>(`/api/users/${userId}`);
}

// 프로필 이미지 업로드 (jpg/png, 5MB 이하 - 초과 시 413 FILE_TOO_LARGE)
export function uploadProfileImage(file: File): Promise<void> {
  const formData = new FormData();
  formData.append("image", file);
  return apiPostForm<void>("/api/users/me/profile/image", formData);
}

// 프로필 이미지 삭제 (설정된 이미지가 없으면 400 PROFILE_IMAGE_NOT_SET)
export function deleteProfileImage(): Promise<void> {
  return apiDelete("/api/users/me/profile/image");
}
