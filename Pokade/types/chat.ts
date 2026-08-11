// 시세 챗봇 API(BE) 응답 형태 — com.pokade.domain.chat.dto 미러링.

// BE ChatQueryRequest.message의 @Size(max=500)과 동일 — 초과 시 400을 반환하므로 프론트에서 먼저 막는다.
export const MAX_CHAT_MESSAGE_LENGTH = 500;

export interface QuickQuestion {
  id: string;
  label: string;
  question: string;
}

export interface ChatQueryResponse {
  sessionId: string;
  answer: string;
  disclaimer: string | null;
}

export type ChatRole = "USER" | "ASSISTANT";

export interface ChatHistoryItem {
  role: ChatRole;
  content: string;
  createdAt: string;
}
