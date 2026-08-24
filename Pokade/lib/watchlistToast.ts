import { QuickWatchlistToggleResult } from "@/hooks/useQuickWatchlistToggle";
import { ToastState } from "@/hooks/useToast";

// 하트(관심) 토글 결과 토스트 — 홈/마켓/카드상세 세 곳이 똑같이 쓰므로 문구와 노출 시간을
// 여기 한 곳에서만 정의한다(#235). 문구가 바뀔 때 세 파일을 각각 고치지 않게 하려는 목적.

// 등록 성공: 눌러서 /watchlist로 이동해 목표가를 입력할 수 있다(등록 시점엔 목표가가 없어도
// 되는 흐름이라, 목표가를 넣을 수 있는 곳으로 가는 길을 여기서 열어준다).
//
// 라벨이 행선지 이름("관심 목록")이 아니라 목적("목표가 설정하러 가기")인 이유: 하트만 눌러 등록하면
// 목표가가 비어 있다는 사실 자체가 화면 어디에도 드러나지 않아서, "목록으로 간다"보다 "거기서 무엇을
// 해야 하는가"가 누를 이유가 된다. 도착지는 /watchlist 그대로이고, 그 화면의 목표가 칸이 곧
// 설정 진입점이라 라벨과 실제로 할 일이 어긋나지 않는다.
export const WATCHLIST_ADDED_TOAST: ToastState = {
  message: "관심 등록했습니다",
  href: "/watchlist",
  linkLabel: "목표가 설정하러 가기",
};

// 기본값(3.5초)보다 길게 두는 이유: 이 토스트는 눌러야 의미가 있는데, 기본 시간은 알아채고
// 커서를 옮기기에 촉박하다. 해제 토스트는 누를 대상이 없어 기본값을 그대로 쓴다.
export const WATCHLIST_ADDED_TOAST_MS = 4000;

export const WATCHLIST_REMOVED_TOAST: ToastState = {
  message: "관심 해제했습니다",
};

// 실패는 읽고 지나가는 알림이 아니라 원인을 확인해야 하는 알림이라 등록 토스트와 같은 4초를 준다 —
// "워치리스트는 최대 20개까지 등록할 수 있습니다" 같은 BE 문구는 기본 시간으로는 짧다.
export const WATCHLIST_ERROR_TOAST_MS = 4000;

// 토글 결과를 그에 맞는 토스트로 옮기는 매핑. 토스트를 띄우는 주체는 여전히 화면이지만
// (showToast를 화면이 넘긴다), "어떤 결과에 어떤 문구·시간"이라는 대응 관계까지 화면마다
// 복사돼 있으면 문구를 한 곳에 모아둔 의미가 없어져서 여기 같이 둔다.
//
// status만이 아니라 결과 객체 전체를 받는 이유: 실패 원인(BE가 내려준 문구)이 result.message에만
// 있어서, status만으로는 무엇이 잘못됐는지 전할 수 없다.
//
// 실패도 여기서 토스트로 띄운다. 예전에는 홈/마켓/카드상세가 각자 카드 옆에 3초짜리 인라인
// 문구를 그렸는데, 마크업과 타이머가 세 곳에 복사돼 있으면서도 정작 잘 보이지 않아
// WATCHLIST_LIMIT_EXCEEDED(20개 상한) 같은 흔한 실패가 "그냥 안 눌림"으로 보였다.
//
// redirected(로그인 화면으로 이동)와 pending(세션 복원 중이라 아무 것도 하지 않음)은 토스트가 없다 —
// 전자는 화면이 통째로 바뀌고, 후자는 사용자가 한 일이 아직 없다.
export function showWatchlistToggleToast(
  result: QuickWatchlistToggleResult,
  showToast: (next: ToastState, durationMs?: number) => void,
) {
  if (result.status === "added") showToast(WATCHLIST_ADDED_TOAST, WATCHLIST_ADDED_TOAST_MS);
  else if (result.status === "removed") showToast(WATCHLIST_REMOVED_TOAST);
  else if (result.status === "error")
    showToast({ message: result.message, tone: "error" }, WATCHLIST_ERROR_TOAST_MS);
}
