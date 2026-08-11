import { useCallback, useEffect, useRef, useState } from "react";
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
const RATE_LIMIT_MESSAGE = "같은 질문을 너무 많이 반복했어요. 1분 후 다시 시도해주세요.";

export interface UseChatOptions {
  // 이력을 마운트 즉시 불러올지 여부. /chat 전체 페이지는 즉시(기본값), 미니 위젯은 처음 열 때(loadHistory 수동 호출)만 불러온다 -
  // 모든 페이지에 항상 마운트돼 있는 위젯이 열리지도 않았는데 로그인 사용자 전원의 이력을 매 페이지마다 조회하는 걸 막기 위함.
  eagerHistory?: boolean;
}

// 시세 챗봇 화면 상태 - 세션 관리, FAQ 프리셋 로드, 이력 로드(로그인 시), 질의 전송을 한곳에서 처리.
// 비로그인 사용자는 FAQ 프리셋 질문만 보낼 수 있고, 자유 입력을 시도하면 로그인 페이지로 보낸다(BE도 동일 정책을 401로 강제).
export function useChat({ eagerHistory = true }: UseChatOptions = {}) {
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
  // 같은 질문 반복으로 서버가 60초 잠금(429)을 걸었을 때 - 카운트다운 없이 전송 버튼만 살짝 비활성화하는 용도.
  const [rateLimited, setRateLimited] = useState(false);
  // send()가 한 번이라도 호출되면 true - 그 뒤로 도착하는 이력 응답이 낙관적 업데이트를 덮어쓰지 않게 막는다.
  const userSentRef = useRef(false);
  // 이력을 이미 불러왔으면(또는 시도했으면) 다시 불러오지 않는다 - loadHistory가 여러 번 호출돼도 요청은 한 번만.
  const historyLoadedRef = useRef(false);

  useEffect(() => {
    fetchQuickQuestions()
      .then(setQuickQuestions)
      .catch(() => setQuickQuestions([]));
  }, []);

  const loadHistory = useCallback(() => {
    if (historyLoadedRef.current) return;
    if (!sessionId || authStatus !== "authenticated") return;
    historyLoadedRef.current = true;
    fetchChatHistory(sessionId)
      .then((page) => {
        if (userSentRef.current) return; // 이력 로드 중 사용자가 이미 메시지를 보냈으면 그 상태를 덮어쓰지 않음
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

  useEffect(() => {
    if (!eagerHistory) return;
    loadHistory();
  }, [eagerHistory, loadHistory]);

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

      userSentRef.current = true;
      setError(null);
      setRateLimited(false);
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
        if (e instanceof ApiError && (e.status === 429 || e.code === "CHAT_RATE_LIMIT_EXCEEDED")) {
          setError(e.message || RATE_LIMIT_MESSAGE);
          setRateLimited(true);
          return;
        }
        setError(RETRY_ERROR_MESSAGE);
      } finally {
        setSending(false);
      }
    },
    [sessionId, sending, isLoggedIn, goToLogin],
  );

  return {
    isLoggedIn,
    messages,
    quickQuestions,
    sending,
    error,
    rateLimited,
    send,
    goToLogin,
    loadHistory,
  };
}
