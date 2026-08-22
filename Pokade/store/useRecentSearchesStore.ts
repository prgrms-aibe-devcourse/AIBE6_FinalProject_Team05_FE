import { create } from "zustand";
import {
  addRecentSearch,
  clearRecentSearches,
  getRecentSearches,
  removeRecentSearch,
} from "@/lib/recentSearches";

/**
 * 최근 검색어 전역 상태 — 실제 저장(localStorage)은 lib/recentSearches.ts가 그대로 담당하고,
 * 이 store는 그 결과를 모든 SearchBar 인스턴스(헤더 여러 곳 + 마켓)가 함께 구독하게만 한다.
 * 이전에는 컴포넌트마다 `useState(() => getRecentSearches())`로 마운트 시점에 한 번만 읽어서,
 * 한 인스턴스에서 검색/삭제해도 같은 화면에 이미 떠 있던 다른 인스턴스는 새로고침 전까지
 * 낡은 목록을 보여주는 문제가 있었다(#199 후속). terms를 store에 두면 set() 한 번으로
 * 구독 중인 모든 인스턴스가 즉시 리렌더된다.
 */
interface RecentSearchesState {
  terms: string[];
  add: (term: string) => void;
  remove: (term: string) => void;
  clear: () => void;
}

export const useRecentSearchesStore = create<RecentSearchesState>((set) => ({
  terms: getRecentSearches(),
  add: (term) => set({ terms: addRecentSearch(term) }),
  remove: (term) => set({ terms: removeRecentSearch(term) }),
  clear: () => {
    clearRecentSearches();
    set({ terms: [] });
  },
}));
