// app/search/page.tsx와 SearchResultsView가 함께 참조하는 필터 상수.
// 세트/타입/레어도 옵션은 GET /api/cards/facets에서 받아오므로(lib/cardApi.ts의
// fetchCardFacets) 여기 없다 — 가격 슬라이더 상한만 카탈로그 데이터가 아니라 그대로 유지.

export const PRICE_MAX = 3000000;
