import { apiGetRaw, apiPostRaw, PageResponse } from "@/lib/apiClient";
import { ChatHistoryItem, ChatQueryResponse, QuickQuestion } from "@/types/chat";

// 자유 입력 또는 FAQ 프리셋 질문(question 값 그대로)을 그대로 보낸다.
// 비로그인 + 프리셋이 아닌 메시지는 BE가 401을 반환한다.
export async function sendChatQuery(sessionId: string, message: string): Promise<ChatQueryResponse> {
  return apiPostRaw<ChatQueryResponse>("/api/chat/query", { sessionId, message });
}

export async function fetchQuickQuestions(): Promise<QuickQuestion[]> {
  return apiGetRaw<QuickQuestion[]>("/api/chat/quick-questions");
}

// 로그인 사용자 전용 — 비로그인 호출은 BE가 401을 반환한다.
export async function fetchChatHistory(
  sessionId: string,
  page = 0,
  size = 20,
): Promise<PageResponse<ChatHistoryItem>> {
  return apiGetRaw<PageResponse<ChatHistoryItem>>(
    `/api/chat/history?sessionId=${encodeURIComponent(sessionId)}&page=${page}&size=${size}`,
  );
}
