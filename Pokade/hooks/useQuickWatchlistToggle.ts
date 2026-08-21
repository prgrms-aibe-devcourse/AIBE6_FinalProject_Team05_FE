"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ApiError } from "@/lib/apiClient";
import { loginUrlFor } from "@/lib/authRedirect";
import { addWatchlist, deleteWatchlistItem, fetchWatchlist } from "@/lib/watchlistApi";
import { useUserStore } from "@/store/useUserStore";

export type QuickWatchlistToggleResult =
  | { status: "added"; watchlistId: number }
  | { status: "removed" }
  | { status: "redirected" }
  | { status: "error"; message: string };

// 하트/워치리스트 버튼 클릭 시 목표가 입력 모달(AddWatchlistModal) 없이 즉시 등록/삭제를 토글하는
// 흐름(#199) — 목표가는 이후 /watchlist에서 입력한다(BE #308: 등록 시점엔 목표가 없어도 허용).
// 호출부가 이미 워치리스트에 있는 카드의 watchlistId를 들고 있다가 넘겨주면 삭제로, null이면
// 등록으로 분기한다 — "이미 있는지"는 이 훅이 아니라 호출부가 fetchWatchlist()로 들고 있는 목록의
// 책임이다(여러 카드에 대해 한 번만 조회하면 되므로 훅이 아니라 페이지 쪽에 두는 게 자연스럽다).
// 모달의 useEffect(비로그인 시 리다이렉트)를 클릭 시점에 직접 수행하도록 옮겨온 것도 그대로 유지.
export function useQuickWatchlistToggle() {
  const authStatus = useUserStore((s) => s.status);
  const router = useRouter();
  const pathname = usePathname();
  const [pendingCardId, setPendingCardId] = useState<number | null>(null);

  const toggle = async (
    cardId: number,
    watchlistId: number | null,
    variantId?: number | null,
  ): Promise<QuickWatchlistToggleResult> => {
    if (authStatus !== "authenticated") {
      router.replace(loginUrlFor(pathname));
      return { status: "redirected" };
    }

    setPendingCardId(cardId);
    try {
      if (watchlistId != null) {
        try {
          await deleteWatchlistItem(watchlistId);
        } catch (err) {
          // 이미 삭제된 항목(다른 탭/기기에서 먼저 삭제) — 사용자 의도(삭제됨)와 결과가 같으므로
          // 에러로 취급하지 않는다.
          if (!(err instanceof ApiError && err.code === "WATCHLIST_NOT_FOUND")) throw err;
        }
        return { status: "removed" };
      }

      const created = await addWatchlist({ cardId, variantId: variantId ?? undefined });
      return { status: "added", watchlistId: created.id };
    } catch (err) {
      if (err instanceof ApiError && err.code === "DUPLICATE_WATCHLIST") {
        // 호출부의 myWatchlist Map이 낡아서(다른 탭에서 방금 등록 등) watchlistId를 null로
        // 잘못 알고 있던 경우 — 등록 자체는 실패지만 "이미 등록된 상태"라는 목표는 이미 달성됐으므로
        // 에러가 아니라 성공으로 취급한다. 다만 새로 생긴 id를 모르므로(이 요청에서 만든 게 아니라
        // 이미 있던 항목이라) 다음 삭제를 위해 전체를 다시 읽어와 Map을 맞춰야 한다 — 호출부가
        // watchlistId: -1(placeholder)을 받으면 무시하고 fetchWatchlist()로 재동기화하게 한다.
        try {
          const list = await fetchWatchlist();
          const existing = list.find((w) => w.cardId === cardId);
          return { status: "added", watchlistId: existing?.id ?? -1 };
        } catch {
          return { status: "added", watchlistId: -1 };
        }
      }
      return {
        status: "error",
        message:
          err instanceof ApiError
            ? err.message
            : watchlistId != null
              ? "관심 해제에 실패했습니다."
              : "관심 등록에 실패했습니다.",
      };
    } finally {
      setPendingCardId(null);
    }
  };

  return { toggle, pendingCardId };
}
