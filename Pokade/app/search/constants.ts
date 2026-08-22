// app/search/page.tsx와 SearchResultsView가 함께 참조하는 필터 상수.
// 세트/타입/레어도 옵션은 GET /api/cards/facets에서 받아오므로(lib/cardApi.ts의
// fetchCardFacets) 여기 없다 — 가격 슬라이더 상한만 카탈로그 데이터가 아니라 그대로 유지.

import { CardSort } from "@/lib/cardApi";

export const PRICE_MAX = 10000000;

// 마켓 한 페이지에 보여줄 카드 수 — BE 기본값(20) 대신 명시적으로 요청한다(#187).
// page.tsx의 API 호출과 SearchResultsView.tsx의 로딩 스켈레톤 칸 수가 항상 같은 값을 보도록
// 여기 하나로 공유한다. 이 상수는 마켓(/search) 전용이라 다른 화면의 페이지 크기와 무관하다.
// 15인 이유(#235): 결과 그리드가 lg에서 5열이라 15개면 정확히 3행이 되고, 그래야 옆의 필터
// 사이드바와 카드 높이가 얼추 맞는다(10개=2행일 때는 결과가 400px 넘게 짧아 눈에 띄게 불균형).
export const MARKET_PAGE_SIZE = 15;

// 가격순 정렬 — BE 정렬 화이트리스트(CardRepository.SORT_COLUMN_WHITELIST: latest/name/popular)에
// 가격이 없다(가격은 cards 테이블이 아니라 별도 listings 테이블에 있어 단순 컬럼 정렬이 아니라 BE
// 작업이 필요 — #142 조사 결과, 임의로 BE를 손대지 않기로 함). 그래서 이 두 값은 BE에 그대로
// 보내지 않고(보내면 화이트리스트에 없어 latest로 조용히 폴백돼 "선택했는데 안 바뀐" 것처럼 보임),
// 이미 로드된 현재 페이지 카드만 SearchResultsView가 가격 기준으로 클라이언트 정렬한다 —
// 페이지를 넘기면 서버 기본 정렬(popular)로 새로 불러온 뒤 그 페이지 안에서 다시 정렬한다.
export type UiSort = CardSort | "priceAsc" | "priceDesc";

export const isPriceSort = (s: UiSort): s is "priceAsc" | "priceDesc" =>
  s === "priceAsc" || s === "priceDesc";

// 언어(국가판) 필터 — 실제 존재 값은 EN/JA뿐(#263 확인). SearchFilterSidebar(체크박스 목록)와
// SearchResultsView(선택된 언어 필터 칩의 라벨 조회)가 함께 참조해서 여기 공유 상수로 둔다.
export const LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "EN", label: "영문판(EN)" },
  { value: "JA", label: "일본판(JA)" },
];
