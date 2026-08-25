// 상품 등록 1단계(카드/판본/가격/등급) 입력을 세션스토리지에 임시 저장한다. 주문서(2단계)에서
// 취소하거나 브라우저 뒤로가기를 하면 app/listings/new가 새로 마운트되면서 useState가 초기화되는데,
// 그때 카드 재검색부터 다시 하지 않도록 복원용으로 쓴다. 등록이 완료되면 더 이상 필요 없으므로 지운다.
const DRAFT_KEY = "pokade:listing-draft";

export interface ListingDraft {
  cardId: number;
  variantId: number | null;
  price: string;
  grade: string | null;
}

export function saveListingDraft(draft: ListingDraft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // 세션스토리지를 쓸 수 없는 환경(프라이빗 모드 등)이면 그냥 포기한다 - 복원 기능만 빠질 뿐
    // 등록 자체는 계속 가능하다.
  }
}

export function loadListingDraft(): ListingDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.cardId !== "number") return null;
    return parsed as ListingDraft;
  } catch {
    return null;
  }
}

export function clearListingDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // no-op — 애초에 못 지워도 다음 진입 시 loadListingDraft가 같은 이유로 실패해 무시된다.
  }
}
