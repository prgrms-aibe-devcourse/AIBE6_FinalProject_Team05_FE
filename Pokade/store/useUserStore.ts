import { create } from "zustand";

/**
 * 유저 세션 전역 상태.
 * Header가 로그인/로그아웃/운영자 상태를 판단할 때 지금은
 * usePathname()으로 임시 분기하고 있는데, 실제 인증 연동 시에는
 * 이 스토어의 isLoggedIn / role 값을 기준으로 바꾸면 됩니다.
 */
interface UserState {
  isLoggedIn: boolean;
  nickname: string | null;
  role: "user" | "admin" | null;
  unreadNotifications: number;
  login: (nickname: string, role?: "user" | "admin") => void;
  logout: () => void;
  markAllNotificationsRead: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  isLoggedIn: false,
  nickname: null,
  role: null,
  unreadNotifications: 3,

  login: (nickname, role = "user") => set({ isLoggedIn: true, nickname, role }),

  logout: () => set({ isLoggedIn: false, nickname: null, role: null }),

  markAllNotificationsRead: () => set({ unreadNotifications: 0 }),
}));
