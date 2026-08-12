// app/search/page.tsx와 SearchResultsView가 함께 참조하는 필터 상수.
// page.tsx는 URL 파라미터 파싱/초기 state 계산에, SearchResultsView는 필터 UI 렌더링에 사용한다.

export const PRICE_MAX = 3000000;

// 세트 체크박스 → BE expansionId 매핑. data.sql에 실제 시드된 세트 8개 전부 노출.
// 뒤 4개(sm11/sm3/sv10_ja/xy7)는 확정된 한글 세트명이 없어 카드 이름의 nameKo 폴백 관례와
// 동일하게 원본 이름(setName) 그대로 라벨로 사용 — 한글명이 확정되면 교체.
export const SET_OPTIONS: { label: string; expansionId: string }[] = [
  { label: "베이스", expansionId: "base1" },
  { label: "151", expansionId: "sv3pt5" },
  { label: "블랙 볼트", expansionId: "zsv10pt5" },
  { label: "메가 에볼루션", expansionId: "me1" },
  { label: "Unified Minds", expansionId: "sm11" },
  { label: "Burning Shadows", expansionId: "sm3" },
  { label: "サンダー", expansionId: "sv10_ja" },
  { label: "Ancient Origins", expansionId: "xy7" },
];

// 타입/레어도 체크박스 값 — 실행 중인 BE(/api/cards)에서 집계한 실제 값·빈도 기준.
// 등장 빈도 내림차순, 동률은 알파벳순. BE #193에서 JA 카드(원본 type=草)도 Grass로 역매핑되어 포함.
export const TYPE_OPTIONS = ["Fire", "Water", "Lightning", "Fairy", "Fighting", "Grass", "Psychic"];
export const RARITY_OPTIONS = [
  "Double Rare",
  "Common",
  "Rare Holo",
  "Rare Holo GX",
  "Illustration Rare",
  "Rare Holo EX",
];
