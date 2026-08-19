import { create } from "zustand";
import * as authApi from "@/lib/authApi";
import { setAccessToken } from "@/lib/authToken";
import { MyInfo } from "@/types/auth";
import { reissueAccessToken, ApiError } from "@/lib/apiClient";
import { importChatHistory } from "@/lib/chatApi";
import { getChatSessionId, peekImportQueue, removeImportQueueEntries } from "@/lib/chatSession";

/**
 * 유저 세션 전역 상태.
 * access 토큰은 lib/authToken(메모리)에, UI용 상태(isLoggedIn/nickname/role)는 여기에 둔다.
 */
interface UserState {
  isLoggedIn: boolean;
  status: "loading" | "authenticated" | "unauthenticated";
  userId: number | null;
  // true인 동안은 로그인은 확정됐지만 userId를 아직 신뢰할 수 없는 상태(프로필 조회 재시도 중) —
  // 구매자/판매자 판정처럼 userId가 꼭 필요한 화면은 이 값이 false로 바뀔 때까지 판정을 미뤄야 한다.
  userIdRestoring: boolean;
  nickname: string | null;
  email: string | null;
  profileImageUrl: string | null; // 서버 상대 경로, 이미지 없으면 null
  role: "user" | "admin" | null;
  // 비로그인 프리셋 이관 성공 시 증가 — useChat이 구독해 이력을 자동 재로드함.
  chatHistoryVersion: number;
  login: (email: string, password: string) => Promise<void>;
  loginWithToken: (accessToken: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: (force?: boolean) => Promise<boolean>;
  setNickname: (nickname: string) => void;
  setProfileImageUrl: (profileImageUrl: string | null) => void;
}

const SESSION_HINT_KEY = "pokade_has_session"; // 세션이 있었음을 기억하는 로컬스토리지 키 (로그인 후 새로고침 시 restoreSession 호출 여부 판단용)

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// BE role(대문자) → 스토어 role(소문자) 매핑
function toStoreRole(role: MyInfo["role"]): "user" | "admin" {
  return role === "ADMIN" ? "admin" : "user";
}

// 비로그인 프리셋 큐 → 서버 이관 (best-effort, 실패해도 로그인을 막지 않음).
// loginWithToken에서만 호출 — restoreSession(새로고침)에서는 호출하지 않는다.
async function flushChatImportQueue(set: (partial: Partial<UserState>) => void): Promise<void> {
  const entries = peekImportQueue();
  if (entries.length === 0) return;
  try {
    await importChatHistory(getChatSessionId(), entries);
    removeImportQueueEntries(entries);
    // useChat이 구독해 이력을 자동 재로드하도록 버전을 올린다
    set({ chatHistoryVersion: Date.now() });
  } catch {
    // 실패 시 큐 보존 — 다음 로그인 때 재시도
  }
}

export const useUserStore = create<UserState>((set, get) => ({
  isLoggedIn: false,
  status: "loading",
  userId: null,
  userIdRestoring: false,
  nickname: null,
  email: null,
  profileImageUrl: null,
  role: null,
  chatHistoryVersion: 0,

  // 이미 발급된 accessToken으로 세션 확정: 토큰 저장 → 프로필 조회 → 상태 세팅 (소셜 가입·로그인 공용)
  loginWithToken: async (accessToken) => {
    setAccessToken(accessToken);
    try {
      const me = await authApi.getMyInfo();
      if (typeof window !== "undefined") localStorage.setItem(SESSION_HINT_KEY, "1");
      set({
        isLoggedIn: true,
        status: "authenticated",
        userId: me.userId,
        userIdRestoring: false,
        nickname: me.nickname,
        email: me.email,
        profileImageUrl: me.profileImageUrl,
        role: toStoreRole(me.role),
      });
      // 비로그인 때 쌓아둔 프리셋 클릭 이력을 서버로 이관 (best-effort, fire-and-forget)
      flushChatImportQueue(set).catch(() => {});
    } catch (err) {
      // 프로필 조회 실패 → 토큰 + 인증 상태를 함께 롤백(부분 상태 불일치 방지)
      setAccessToken(null);
      if (typeof window !== "undefined") localStorage.removeItem(SESSION_HINT_KEY);
      set({
        isLoggedIn: false,
        status: "unauthenticated",
        userId: null,
        userIdRestoring: false,
        nickname: null,
        email: null,
        profileImageUrl: null,
        role: null,
      });
      throw err; // 화면에서 에러 처리하도록 재throw
    }
  },

  // 로그인: 토큰 발급 후 공통 메서드 재사용
  login: async (email, password) => {
    const { accessToken } = await authApi.login({ email, password });
    await get().loginWithToken(accessToken);
  },

  // 로그아웃: 서버 무효화(best-effort) + 클라 상태·토큰 초기화(항상)
  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // 서버 무효화 실패는 무시(best-effort) — 클라 상태는 항상 초기화
    }
    setAccessToken(null);
    if (typeof window !== "undefined") localStorage.removeItem(SESSION_HINT_KEY);
    set({
      isLoggedIn: false,
      status: "unauthenticated",
      userId: null,
      userIdRestoring: false,
      nickname: null,
      profileImageUrl: null,
      email: null,
      role: null,
    });
  },

  // 새로고침 복원: refresh 쿠키로 reissue → 프로필 → 상태 복원 (없으면 비로그인 유지)
  restoreSession: async (force = false): Promise<boolean> => {
    if (!force && typeof window !== "undefined" && !localStorage.getItem(SESSION_HINT_KEY)) {
      setAccessToken(null);
      set({
        isLoggedIn: false,
        status: "unauthenticated",
        userId: null,
        userIdRestoring: false,
        nickname: null,
        email: null,
        profileImageUrl: null,
        role: null,
      });
      return false;
    }

    let token: string | null = null;
    try {
      token = await reissueAccessToken();
    } catch {
      token = null; // reissue 자체 예외도 비로그인으로 흡수 (호출부 무한 로딩 방지)
    }
    if (!token) {
      setAccessToken(null);
      if (typeof window !== "undefined") localStorage.removeItem(SESSION_HINT_KEY);
      set({
        isLoggedIn: false,
        status: "unauthenticated",
        userId: null,
        userIdRestoring: false,
        nickname: null,
        email: null,
        profileImageUrl: null,
        role: null,
      });
      return false;
    }

    // 프로필 조회 전에 먼저 "로그인은 됐지만 userId는 아직 모름" 상태를 노출한다 —
    // 구매자 판정처럼 userId가 꼭 필요한 화면이 이 값을 보고 판정을 미룰 수 있게.
    set({ isLoggedIn: true, status: "authenticated", userIdRestoring: true });
    if (typeof window !== "undefined") localStorage.setItem(SESSION_HINT_KEY, "1");
    try {
      const me = await authApi.getMyInfo();
      set({
        userId: me.userId,
        userIdRestoring: false,
        nickname: me.nickname,
        email: me.email,
        profileImageUrl: me.profileImageUrl,
        role: toStoreRole(me.role),
      });
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // 실제 인증 실패 → 세션 정리
        setAccessToken(null);
        if (typeof window !== "undefined") localStorage.removeItem(SESSION_HINT_KEY);
        set({
          isLoggedIn: false,
          status: "unauthenticated",
          userId: null,
          userIdRestoring: false,
          nickname: null,
          email: null,
          profileImageUrl: null,
          role: null,
        });
        return false;
      }
    }

    // 일시 오류(네트워크/5xx) → reissue는 성공했으니 세션 자체는 유효. 잠깐 쉬었다가 한 번 더 시도.
    await delay(1000);
    try {
      const me = await authApi.getMyInfo();
      set({
        userId: me.userId,
        userIdRestoring: false,
        nickname: me.nickname,
        email: me.email,
        profileImageUrl: me.profileImageUrl,
        role: toStoreRole(me.role),
      });
      return true;
    } catch {
      // 재시도도 실패 — userId는 모르지만 reissue는 성공했으니 로그인 자체는 유효.
      set({ userIdRestoring: false });
      return true;
    }
  },

  setNickname: (nickname) => set({ nickname }),
  setProfileImageUrl: (profileImageUrl) => set({ profileImageUrl }),
}));
