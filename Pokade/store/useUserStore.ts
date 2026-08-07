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
  userId: number | null;
  // true인 동안은 로그인은 확정됐지만 userId를 아직 신뢰할 수 없는 상태(프로필 조회 재시도 중) —
  // 구매자/판매자 판정처럼 userId가 꼭 필요한 화면은 이 값이 false로 바뀔 때까지 판정을 미뤄야 한다.
  userIdRestoring: boolean;
  nickname: string | null;
  email: string | null;
  role: "user" | "admin" | null;
  unreadNotifications: number;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  markAllNotificationsRead: () => void;
  setNickname: (nickname: string) => void;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// BE role(대문자) → 스토어 role(소문자) 매핑
function toStoreRole(role: MyInfo["role"]): "user" | "admin" {
  return role === "ADMIN" ? "admin" : "user";
}

export const useUserStore = create<UserState>((set) => ({
  isLoggedIn: false,
  status: "loading",
  userId: null,
  userIdRestoring: false,
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
        userId: me.userId,
        userIdRestoring: false,
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
    set({
      isLoggedIn: false,
      status: "unauthenticated",
      userId: null,
      userIdRestoring: false,
      nickname: null,
      email: null,
      role: null,
    });
  },

  // 새로고침 복원: refresh 쿠키로 reissue → 프로필 → 상태 복원 (없으면 비로그인 유지)
  restoreSession: async () => {
    const token = await reissueAccessToken();
    if (!token) {
      setAccessToken(null);
      set({
        isLoggedIn: false,
        status: "unauthenticated",
        userId: null,
        userIdRestoring: false,
        nickname: null,
        email: null,
        role: null,
      });
      return;
    }

    // 프로필 조회 전에 먼저 "로그인은 됐지만 userId는 아직 모름" 상태를 노출한다 —
    // 구매자 판정처럼 userId가 꼭 필요한 화면이 이 값을 보고 판정을 미룰 수 있게.
    set({ isLoggedIn: true, status: "authenticated", userIdRestoring: true });

    try {
      const me = await authApi.getMyInfo();
      set({
        userId: me.userId,
        userIdRestoring: false,
        nickname: me.nickname,
        email: me.email,
        role: toStoreRole(me.role),
      });
      return;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // 실제 인증 실패 → 세션 정리
        setAccessToken(null);
        set({
          isLoggedIn: false,
          status: "unauthenticated",
          userId: null,
          userIdRestoring: false,
          nickname: null,
          email: null,
          role: null,
        });
        return;
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
        role: toStoreRole(me.role),
      });
    } catch {
      // 재시도도 실패 — userId는 여전히 모르는 채로 복원 시도만 종료(무한 로딩 방지).
      set({ userIdRestoring: false });
    }
  },

  markAllNotificationsRead: () => set({ unreadNotifications: 0 }),
  setNickname: (nickname) => set({ nickname }),
}));
