import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import { loginUrlFor } from "@/lib/authRedirect";
import { getChatSessionId } from "@/lib/chatSession";
import { fetchChatHistory, fetchQuickQuestions, sendChatQuery } from "@/lib/chatApi";
import { ApiError } from "@/lib/apiClient";
import { QuickQuestion } from "@/types/chat";

export interface ChatUiMessage {
  role: "user" | "assistant";
  content: string;
  disclaimer?: string | null;
}

const RETRY_ERROR_MESSAGE = "답변을 가져오지 못했어요. 잠시 후 다시 시도해 주세요.";

// 시세 챗봇 화면 상태 - 세션 관리, FAQ 프리셋 로드, 이력 로드(로그인 시), 질의 전송을 한곳에서 처리.
// 비로그인 사용자는 FAQ 프리셋 질문만 보낼 수 있고, 자유 입력을 시도하면 로그인 페이지로 보낸다(BE도 동일 정책을 401로 강제).
export function useChat() {
  const router = useRouter();
  const pathname = usePathname();
  const isLoggedIn = useUserStore((s) => s.isLoggedIn);
  const authStatus = useUserStore((s) => s.status);

  // 지연 초기화라서 클라이언트 첫 렌더에서 바로 실제 sessionId를 얻는다(effect 불필요) -
  // SSR 시점 값("")은 화면에 그려지지 않고 API 호출용으로만 쓰여서 하이드레이션 불일치가 없다.
  const [sessionId] = useState(() => getChatSessionId());
  const [messages, setMessages] = useState<ChatUiMessage[]>([]);
  const [quickQuestions, setQuickQuestions] = useState<QuickQuestion[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchQuickQuestions()
      .then(setQuickQuestions)
      .catch(() => setQuickQuestions([]));
  }, []);

  useEffect(() => {
    if (!sessionId || authStatus !== "authenticated") return;
    fetchChatHistory(sessionId)
      .then((page) => {
        setMessages(
          page.content.map((m) => ({
            role: m.role === "USER" ? "user" : "assistant",
            content: m.content,
          })),
        );
      })
      .catch(() => {
        // 비로그인/세션 만료(401)는 조용히 무시 - 새 대화로 취급
      });
  }, [sessionId, authStatus]);

  const goToLogin = useCallback(() => {
    router.push(loginUrlFor(pathname));
  }, [router, pathname]);

  const send = useCallback(
    async (rawText: string, isPreset: boolean) => {
      const text = rawText.trim();
      if (!text || !sessionId || sending) return;

      if (!isLoggedIn && !isPreset) {
        goToLogin();
        return;
      }

      setError(null);
      setMessages((prev) => [...prev, { role: "user", content: text }]);
      setSending(true);
      try {
        const res = await sendChatQuery(sessionId, text);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: res.answer, disclaimer: res.disclaimer },
        ]);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          goToLogin();
          return;
        }
        setError(RETRY_ERROR_MESSAGE);
      } finally {
        setSending(false);
      }
    },
    [sessionId, sending, isLoggedIn, goToLogin],
  );

  return { isLoggedIn, messages, quickQuestions, sending, error, send, goToLogin };
}
