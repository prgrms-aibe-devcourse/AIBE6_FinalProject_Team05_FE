import { ToastState } from "@/hooks/useToast";

// 하트(관심) 토글 결과 토스트 — 홈/마켓/카드상세 세 곳이 똑같이 쓰므로 문구와 노출 시간을
// 여기 한 곳에서만 정의한다(#235). 문구가 바뀔 때 세 파일을 각각 고치지 않게 하려는 목적.

// 등록 성공: 눌러서 /watchlist로 이동해 목표가를 입력할 수 있다(등록 시점엔 목표가가 없어도
// 되는 흐름이라, 목표가를 넣을 수 있는 곳으로 가는 길을 여기서 열어준다).
export const WATCHLIST_ADDED_TOAST: ToastState = {
  message: "관심 등록했습니다",
  href: "/watchlist",
  linkLabel: "관심 목록",
};

// 기본 2.5초보다 길게 두는 이유: 이 토스트는 눌러야 의미가 있는데, 2.5초는 알아채고 커서를
// 옮기기에 촉박하다. 해제 토스트는 누를 대상이 없어 기존 기본값(2.5초)을 그대로 쓴다.
export const WATCHLIST_ADDED_TOAST_MS = 4000;

export const WATCHLIST_REMOVED_TOAST: ToastState = {
  message: "관심 해제했습니다",
};

// 토글 결과 status를 그에 맞는 토스트로 옮기는 매핑. 토스트를 띄우는 주체는 여전히 화면이지만
// (showToast를 화면이 넘긴다), "어떤 status에 어떤 문구·시간"이라는 대응 관계까지 화면마다
// 복사돼 있으면 문구를 한 곳에 모아둔 의미가 없어져서 여기 같이 둔다.
// redirected(비로그인 → 로그인 이동)와 error(각 화면이 카드 옆에 직접 표시)는 토스트가 없다.
export function showWatchlistToggleToast(
  status: "added" | "removed" | "redirected" | "error",
  showToast: (next: ToastState, durationMs?: number) => void,
) {
  if (status === "added") showToast(WATCHLIST_ADDED_TOAST, WATCHLIST_ADDED_TOAST_MS);
  else if (status === "removed") showToast(WATCHLIST_REMOVED_TOAST);
}
