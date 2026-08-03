import { create } from "zustand";
import * as authApi from "@/lib/authApi";
import { setAccessToken } from "@/lib/authToken";
import { MyInfo } from "@/types/auth";
import { reissueAccessToken, ApiError } from "@/lib/apiClient";

/**
 * 유저 세션 전역 상태.
 * access 토큰은 lib/authToken(메모리)에, UI용 상태(isLoggedIn/nickname/role)는 여기에 둔다.
 */
interface UserState {
  isLoggedIn: boolean;
  status: "loading" | "authenticated" | "unauthenticated";
  nickname: string | null;
  email: string | null;
  role: "user" | "admin" | null;
  unreadNotifications: number;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  markAllNotificationsRead: () => void;
}

// BE role(대문자) → 스토어 role(소문자) 매핑
function toStoreRole(role: MyInfo["role"]): "user" | "admin" {
  return role === "ADMIN" ? "admin" : "user";
}

export const useUserStore = create<UserState>((set) => ({
  isLoggedIn: false,
  status: "loading",
  nickname: null,
  email: null,
  role: null,
  unreadNotifications: 3,

  // 로그인: accessToken 저장 → 프로필 조회 → 상태 세팅 (실패 시 throw → 화면에서 처리)
  login: async (email, password) => {
    const { accessToken } = await authApi.login({ email, password });
    setAccessToken(accessToken);
    try {
      const me = await authApi.getMyInfo();
      set({
        isLoggedIn: true,
        status: "authenticated",
        nickname: me.nickname,
        email: me.email,
        role: toStoreRole(me.role),
      });
    } catch (err) {
      setAccessToken(null); // 프로필 조회 실패 → 토큰 롤백(상태 불일치 방지)
      throw err; // 화면에서 에러 처리하도록 재throw
    }
  },

  // 로그아웃: 서버 무효화(best-effort) + 클라 상태·토큰 초기화(항상)
  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // 서버 무효화 실패는 무시(best-effort) — 클라 상태는 항상 초기화
    }
    setAccessToken(null);
    set({ isLoggedIn: false, status: "unauthenticated", nickname: null, email: null, role: null });
  },

  // 새로고침 복원: refresh 쿠키로 reissue → 프로필 → 상태 복원 (없으면 비로그인 유지)
  restoreSession: async () => {
    const token = await reissueAccessToken();
    if (!token) {
      setAccessToken(null);
      set({
        isLoggedIn: false,
        status: "unauthenticated",
        nickname: null,
        email: null,
        role: null,
      });
      return;
    }
    try {
      const me = await authApi.getMyInfo();
      set({
        isLoggedIn: true,
        status: "authenticated",
        nickname: me.nickname,
        email: me.email,
        role: toStoreRole(me.role),
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // 실제 인증 실패 → 세션 정리
        setAccessToken(null);
        set({
          isLoggedIn: false,
          status: "unauthenticated",
          nickname: null,
          email: null,
          role: null,
        });
      } else {
        // 일시 오류(네트워크/5xx) → reissue는 성공했으니 세션은 유효. 토큰 유지, 프로필만 비움
        set({ isLoggedIn: true, status: "authenticated", nickname: null, email: null, role: null });
      }
    }
  },

  markAllNotificationsRead: () => set({ unreadNotifications: 0 }),
}));
