// 시세 챗봇 API(BE) 응답 형태 — com.pokade.domain.chat.dto 미러링.

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
