"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ApiError } from "@/lib/apiClient";
import { loginUrlFor } from "@/lib/authRedirect";
import { addWatchlist } from "@/lib/watchlistApi";
import { useUserStore } from "@/store/useUserStore";

export type QuickWatchlistAddResult =
  | { status: "added" }
  | { status: "duplicate" }
  | { status: "redirected" }
  | { status: "error"; message: string };

// 하트/워치리스트 버튼 클릭 시 목표가 입력 모달(AddWatchlistModal) 없이 즉시 등록하는 흐름(#199) —
// 목표가는 이후 /watchlist에서 입력한다(BE #308: 등록 시점엔 목표가 없어도 허용, 목표가 있는
// 수정 시에는 여전히 최소 1개 필요 — 그건 AddWatchlistModal의 edit 모드가 그대로 담당).
// 모달의 useEffect(비로그인 시 리다이렉트)를 클릭 시점에 직접 수행하도록 옮겨온 것 — 모달을 아예
// 열지 않으므로 그 effect가 실행될 기회가 없어서 클릭 핸들러 안에서 같은 가드를 해줘야 한다.
// DUPLICATE_WATCHLIST(409)는 실패가 아니라 "이미 등록됨"으로 취급해 호출부가 하트를 채운 상태로
// 맞출 수 있게 별도 status를 내려준다.
export function useQuickWatchlistAdd() {
  const authStatus = useUserStore((s) => s.status);
  const router = useRouter();
  const pathname = usePathname();
  const [pendingCardId, setPendingCardId] = useState<number | null>(null);

  const addToWatchlist = async (
    cardId: number,
    variantId?: number | null,
  ): Promise<QuickWatchlistAddResult> => {
    if (authStatus !== "authenticated") {
      router.replace(loginUrlFor(pathname));
      return { status: "redirected" };
    }

    setPendingCardId(cardId);
    try {
      await addWatchlist({ cardId, variantId: variantId ?? undefined });
      return { status: "added" };
    } catch (err) {
      if (err instanceof ApiError && err.code === "DUPLICATE_WATCHLIST") {
        return { status: "duplicate" };
      }
      return {
        status: "error",
        message: err instanceof ApiError ? err.message : "워치리스트 등록에 실패했습니다.",
      };
    } finally {
      setPendingCardId(null);
    }
  };

  return { addToWatchlist, pendingCardId };
}
