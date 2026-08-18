import { API_BASE_URL } from "@/lib/apiClient";

// BE가 주는 profileImageUrl은 절대 URL이 아니라 서버 상대 경로(/api/users/{id}/profile/image)이다.
// 그대로 img src에 넣으면 FE 오리진으로 요청이 나가 404가 되므로, 여기서만 API_BASE_URL을 붙인다.
export function profileImageSrc(path: string | null | undefined): string | null {
  return path ? `${API_BASE_URL}${path}` : null;
}

// 업로드, 삭제 직후 같은 경로의 옛 이미지가 그대로 보이지 않도록 버전 쿼리를 덧붙인다.
export function withCacheBuster(path: string): string {
  return `${path}?v=${Date.now()}`;
}
