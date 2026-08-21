// 시세 챗봇 API(BE) 응답 형태 — com.pokade.domain.chat.dto 미러링.

// BE ChatQueryRequest.message의 @Size(max=500)과 동일 — 초과 시 400을 반환하므로 프론트에서 먼저 막는다.
export const MAX_CHAT_MESSAGE_LENGTH = 500;

export interface QuickQuestion {
  id: string;
  label: string;
  question: string;
}

export interface RankingItem {
  cardName: string;
  price: number;        // 원 단위 정수 (예: 15000)
  changeRate: number;   // 등락률 % (양수=급등, 음수=급락)
  changeAmount: number; // 등락액 원 단위 (양수=상승, 음수=하락)
}

export interface ChatQueryResponse {
  sessionId: string;
  answer: string | null;
  disclaimer: string | null;
  rankingItems: RankingItem[] | null;
}

export type ChatRole = "USER" | "ASSISTANT";

export interface ChatHistoryItem {
  role: ChatRole;
  content: string;
  createdAt: string;
}

// POST /api/chat/history/import — 비로그인 프리셋 클릭 이력을 로그인 후 서버에 이관.
export interface ChatHistoryImportEntry {
  presetId: string;
  askedAt: string; // ISO-8601 Instant
}

export interface ChatHistoryImportRequest {
  sessionId: string;
  entries: ChatHistoryImportEntry[];
}

export interface ChatHistoryImportResponse {
  imported: number;
  skipped: number;
}
