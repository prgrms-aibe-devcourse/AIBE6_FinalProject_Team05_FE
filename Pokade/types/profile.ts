// GET /api/users/me/profile — 본인 전용 상세. 마이페이지 진입 시에만 호출한다
// (GET /api/users/me 는 세션 복원마다 불리는 경량 응답이라 연락처·생년월일 같은 PII를 담지 않는다).
export interface MyProfile {
  email: string;
  phoneNumber: string | null;
  provider: "LOCAL" | "GOOGLE" | "KAKAO";
  socialLinked: boolean;
  joinedAt: string;
  birthDate: string | null;
  marketingAgreed: boolean;
}

// GET /api/users/{userId} — 비로그인도 조회 가능한 공개 프로필.
// 확정 탈퇴 계정은 404(USER_NOT_FOUND), 탈퇴 유예 중인 계정은 정상 응답이며 그 사실이 드러나지 않는다.
// profileImageUrl은 절대 URL이 아니라 서버 상대 경로(/api/users/{id}/profile/image)이며,
// 이미지가 없으면 null이다. 화면에서는 profileImageSrc()로 변환해서 쓴다.
export interface PublicProfile {
  userId: number;
  nickname: string;
  profileImageUrl: string | null;
  joinedAt: string;
  completedTradeCount: number;
  activeListingCount: number;
}
