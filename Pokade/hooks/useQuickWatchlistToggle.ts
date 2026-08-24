"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ApiError } from "@/lib/apiClient";
import { loginUrlFor } from "@/lib/authRedirect";
import { addWatchlist, deleteWatchlistItem, fetchWatchlist } from "@/lib/watchlistApi";
import { useUserStore } from "@/store/useUserStore";

export type QuickWatchlistToggleResult =
  | { status: "added"; watchlistId: number }
  | { status: "removed" }
  | { status: "redirected" }
  // 세션 복원이 끝나지 않아 로그인 여부를 아직 모르는 상태 — 아무 것도 하지 않고 물러난다.
  // "실패"가 아니므로 에러 문구도, 되돌릴 상태 변화도 없다.
  | { status: "pending" }
  | { status: "error"; message: string };

// 호출부가 결과에 따라 후속 연출(하트 펀치 등)을 분기할 수 있도록 status만 따로 노출한다.
// 페이지의 핸들러는 상태 갱신/토스트까지 마친 뒤 이 값을 그대로 돌려주고, 버튼 쪽은
// "added"일 때만 애니메이션을 재생한다 — 등록 실패에도 하트가 튀어오르는 것을 막기 위함.
export type QuickWatchlistToggleStatus = QuickWatchlistToggleResult["status"];

// 하트/워치리스트 버튼 클릭 시 목표가 입력 모달(AddWatchlistModal) 없이 즉시 등록/삭제를 토글하는
// 흐름(#199) — 목표가는 이후 /watchlist에서 입력한다(BE #308: 등록 시점엔 목표가 없어도 허용).
// 호출부가 이미 워치리스트에 있는 카드의 watchlistId를 들고 있다가 넘겨주면 삭제로, null이면
// 등록으로 분기한다 — "이미 있는지"는 이 훅이 아니라 호출부가 fetchWatchlist()로 들고 있는 목록의
// 책임이다(여러 카드에 대해 한 번만 조회하면 되므로 훅이 아니라 페이지 쪽에 두는 게 자연스럽다).
// 모달의 useEffect(비로그인 시 리다이렉트)를 클릭 시점에 직접 수행하도록 옮겨온 것도 그대로 유지하되,
// 로그인 여부를 세 값("loading"/"authenticated"/"unauthenticated")으로 나눠 본다 — 아래 toggle 참고.
//
// useSearchParams를 쓰므로 이 훅을 부르는 화면은 Suspense 경계 안에 있어야 한다(Next.js가 정적
// 프리렌더를 포기하며 빌드에서 막는다). /search와 /cards/[id]는 이미 그렇게 돼 있고, 홈은 이
// 변경과 함께 같은 모양으로 감쌌다.
export function useQuickWatchlistToggle() {
  const authStatus = useUserStore((s) => s.status);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pendingCardId, setPendingCardId] = useState<number | null>(null);

  const toggle = async (
    cardId: number,
    watchlistId: number | null,
    variantId?: number | null,
  ): Promise<QuickWatchlistToggleResult> => {
    // 세션 복원 중에는 로그인 여부가 아직 확정되지 않았다. 여기서 "비로그인"으로 단정하면
    // 새로고침 직후 하트를 누른 로그인 사용자가 그 이유만으로 로그인 화면에 튕겨나간다.
    // 확정될 때까지 아무 것도 하지 않는다 — 같은 파일의 다른 진입(app/cards/[id]/page.tsx의
    // 구매/판매 흐름)이 쓰는 규칙과 동일하다.
    if (authStatus === "loading") return { status: "pending" };

    if (authStatus !== "authenticated") {
      // replace가 아니라 push: 로그인 화면에서 뒤로가기로 보던 목록/상세로 돌아올 수 있어야 한다.
      // searchParams까지 넘겨 /search의 필터·정렬·페이지가 로그인 후에도 그대로 복원되게 한다
      // (loginUrlFor의 2번째 인자. 이 훅만 빠져 있었다).
      router.push(loginUrlFor(pathname, searchParams));
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
        // 에러가 아니라 성공으로 취급한다. 다만 이 요청에서 만든 항목이 아니라 원래 있던 항목이라
        // id를 모르므로, 전체를 다시 읽어 그 카드의 실제 id를 찾아 돌려준다.
        //
        // 찾지 못하거나 재조회가 실패하면 "등록됨"으로 보고하지 않는다. 예전에는 여기서 -1을
        // placeholder로 돌려주고 "호출부가 이를 보고 fetchWatchlist()로 재동기화한다"는 계약을
        // 주석으로만 선언했는데, 그 재동기화를 구현한 호출부가 한 곳도 없었다. 그래서 -1이 그대로
        // Map에 저장됐고, 다음 클릭은 DELETE /api/watchlist/-1로 나가 404가 됐다. 그 404를
        // "이미 삭제됨"으로 삼키는 아래 분기 때문에 하트만 비워지고 서버 항목은 그대로 남았다.
        // id를 확실히 모르는 상태를 아예 만들지 않는 편이 안전하다 — 실패로 알리면 사용자가 다시
        // 누를 수 있고, 다음 마운트의 fetchWatchlist()가 하트 채움 상태를 바로잡는다.
        try {
          const list = await fetchWatchlist();
          const existing = list.find((w) => w.cardId === cardId);
          if (existing) return { status: "added", watchlistId: existing.id };
        } catch {
          // 아래 공통 실패 반환으로 떨어진다.
        }
        return {
          status: "error",
          message: "관심 등록 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        };
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
