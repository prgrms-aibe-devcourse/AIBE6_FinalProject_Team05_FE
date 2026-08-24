"use client";

import { useEffect, useState } from "react";
import { fetchWatchlist } from "@/lib/watchlistApi";
import { useUserStore } from "@/store/useUserStore";
import {
  QuickWatchlistToggleResult,
  useQuickWatchlistToggle,
} from "@/hooks/useQuickWatchlistToggle";

// 목록 화면(홈/마켓)이 하트를 그리기 위해 필요한 워치리스트 상태 한 세트.
//
// 홈(app/page.tsx)과 마켓(app/search/page.tsx)이 ① cardId→watchlistId Map ② 로그인 확정 시
// 전체를 한 번 읽어오는 effect ③ 토글 핸들러를 글자 단위로 같은 코드로 각자 들고 있었다(#235).
// 하나만 고치면 다른 하나가 뒤처지는 상태라 여기로 합쳤다.
//
// 카드 상세(app/cards/[id]/page.tsx)는 제외한다 — 카드 하나만 다루므로 Map이 아니라 단일 객체를
// 쓰고, 관심수(watchlistCount) ±1과 variantId 전달이 더 붙어 구조 자체가 다르다. 억지로 합치면
// 분기가 늘어나기만 한다.
//
// 부수효과(토스트/펀치 애니메이션)는 일부러 여기 넣지 않았다. 이 훅은 "무엇이 등록돼 있는가"라는
// 상태만 책임지고, 그 결과를 어떻게 보여줄지는 화면마다 다르므로(펀치는 클릭한 하트 엘리먼트를
// 알아야 하고, 마켓은 하트가 자식 컴포넌트에 있다) handleHeartClick이 돌려주는 결과를 보고
// 화면이 직접 처리한다.
//
// 실패 문구도 더 이상 여기서 들고 있지 않다 — 예전에는 카드별 에러 상태(cardId+message)를 3초
// 타이머와 함께 보관하고 화면이 카드 옆에 인라인으로 그렸는데, 지금은 화면이 결과를
// showWatchlistToggleToast로 넘겨 토스트 한 곳에서만 보여준다(lib/watchlistToast.ts).
export function useWatchlistMap() {
  const authStatus = useUserStore((s) => s.status);
  // cardId -> watchlistId. 이 카드가 이미 내 워치리스트에 있는지, 있다면 삭제할 때 필요한 id까지
  // 함께 들고 있는다(하트 채움 여부도 이 Map으로 판정 — 별도 boolean 상태를 두지 않는다).
  const [myWatchlist, setMyWatchlist] = useState<Map<number, number>>(new Map());
  const { toggle, pendingCardId } = useQuickWatchlistToggle();

  // 로그인 상태가 확정되면 내 워치리스트 전체를 한 번 불러와 하트 채움 여부/삭제용 id를 안다.
  // 비로그인이면 빈 Map으로 남겨 하트가 전부 빈 상태로 보이게 한다(클릭하면 로그인으로 유도됨).
  useEffect(() => {
    if (authStatus !== "authenticated") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 로그아웃 시 직전 사용자의 워치리스트 흔적을 즉시 비운다.
      setMyWatchlist(new Map());
      return;
    }
    let cancelled = false;

    fetchWatchlist()
      .then((list) => {
        if (!cancelled) setMyWatchlist(new Map(list.map((w) => [w.cardId, w.id])));
      })
      .catch(() => {
        // 조회 실패는 조용히 무시 — 하트는 빈 상태로 보이고, 실제 등록 시도 자체는 그대로 동작한다.
      });

    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  // 토글 결과를 그대로 돌려준다 — 토스트와 하트 펀치를 "서버가 등록을 확정한 뒤"에만 재생하기
  // 위해 호출부(화면)가 이 값을 보고 분기한다. status만이 아니라 결과 객체 전체를 돌려주는 이유는
  // 실패 문구가 result.message에만 있어서다(showWatchlistToggleToast가 이 객체를 그대로 받는다).
  //
  // useCallback으로 감싸지 않는다: 최신 myWatchlist를 그대로 읽어야 하는데 의존성에 Map을 넣으면
  // 어차피 매 변경마다 새 함수가 되고, 빼면 낡은 Map을 읽는 버그가 된다. 추출 전과 동일하게
  // 매 렌더 새로 만든다(동작 차이 없음).
  const handleHeartClick = async (cardId: number): Promise<QuickWatchlistToggleResult> => {
    const watchlistId = myWatchlist.get(cardId) ?? null;
    const result = await toggle(cardId, watchlistId);
    if (result.status === "added") {
      setMyWatchlist((m) => new Map(m).set(cardId, result.watchlistId));
    } else if (result.status === "removed") {
      setMyWatchlist((m) => {
        const next = new Map(m);
        next.delete(cardId);
        return next;
      });
    }
    return result;
  };

  return { myWatchlist, handleHeartClick, pendingCardId };
}
