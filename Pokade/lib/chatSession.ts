const STORAGE_KEY = "pocket-trade:chat-session-id";

// 챗봇 세션 ID — 최초 진입 시 UUID를 생성해 localStorage에 저장, 이후 재사용.
// 비로그인 상태에서도 대화가 이어지도록 로그아웃해도 지우지 않는다.
export function getChatSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
