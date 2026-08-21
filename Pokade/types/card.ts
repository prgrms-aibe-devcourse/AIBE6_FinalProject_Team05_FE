// 카드검색 API(BE) 응답 형태 — com.pokade.domain.card.dto.CardResponse 미러링.
export interface CardResponse {
  id: number;
  externalId: string;
  name: string;
  nameKo?: string | null;
  // 언어(국가판) 코드 — 실제 존재 값은 EN/JA뿐(#263, 다른 값 없음 확인됨).
  languageCode: string;
  setName: string;
  rarity: string;
  supertype: string;
  types: string[];
  imageSmall: string;
  imageMedium: string;
  expansionId: string | null;
  // 판매 중인 매물의 등급 목록. BE가 GRADE_DISPLAY_ORDER(S>A>B) 순으로 정렬해서 내려준다.
  // 매물이 없으면 빈 배열.
  grades: string[];
  // 오타 등으로 정확 일치 결과가 없어 유사검색으로 대체된 항목이면 true(#187). 정확 검색이거나
  // /api/cards, /api/cards/{id}/related처럼 유사검색을 적용하지 않는 응답에서는 항상 false로
  // 온다 — 다만 FE는 이 값을 신뢰해 안내 문구 표시 여부를 결정하지 않고, 키워드 검색(q) 경로인지
  // 자체로 한 번 더 걸러낸다(app/search/page.tsx의 hasFuzzyMatch 계산 참고).
  fuzzyMatch: boolean;
}

// 화면(카드 검색 그리드)이 쓰는 형태.
export interface CardSearchItem {
  id: number;
  name: string;
  // 원본 name/nameKo — pickDisplayName이 검색어와 실제 매칭된 필드를 고르는 데 쓴다.
  nameEn: string;
  nameKo?: string | null;
  set: string;
  imageUrl: string;
  types: string[];
  // CardResponse.grades 그대로 — 검색 타일이 "다른 등급도 있음" 힌트를 보여줄 때 쓴다.
  grades: string[];
  // CardResponse.languageCode 그대로 — 검색 타일 언어 배지에 쓴다.
  languageCode: string;
}

// #263 — 타입/레어도 옵션 하나에 딸린 결과 개수. count는 전체 기준 고정 집계로,
// 다른 필터를 선택해도 바뀌지 않는다(BE CardFacetsResponse.FacetOption 주석 참고) — FE는
// 이 값을 그대로 표시만 하고 재계산하지 않는다.
export interface CardFacetOption {
  value: string;
  count: number;
}

// GET /api/cards/facets 응답 — 검색 필터(세트/타입/레어도) 체크박스가 쓰는 옵션 목록.
// expansions는 series 그룹 최신순 → 그룹 내부 이름순으로 이미 정렬돼 내려온다(FE 재정렬 금지).
export interface CardFacetsResponse {
  types: CardFacetOption[];
  rarities: CardFacetOption[];
  expansions: { id: string; name: string; series: string; count: number }[];
}

export function toCardSearchItem(card: CardResponse): CardSearchItem {
  return {
    id: card.id,
    name: card.nameKo ?? card.name,
    nameEn: card.name,
    nameKo: card.nameKo,
    set: `${card.setName} · ${card.rarity}`,
    imageUrl: card.imageMedium || card.imageSmall,
    types: card.types,
    grades: card.grades,
    languageCode: card.languageCode,
  };
}

// 카드 상세 API(BE) 응답 형태 — com.pokade.domain.card.dto.CardDetailResponse 미러링.
export interface ExpansionSummary {
  id: string;
  name: string;
  series: string;
  code: string;
  total: number;
  releaseDate: string | null;
  logo: string;
  symbol: string;
}

export interface VariantSummary {
  id: number;
  variantName: string;
  primary: boolean;
  imageSmall: string;
  imageLarge: string;
  // 이 판본으로 등록된 매물의 등급 목록(S/A/B, GRADE_DISPLAY_ORDER 순). 매물이 없으면 빈 배열.
  grades: string[];
}

// BE(Scrydex 동기화)가 원본 그대로 내려주는 variantName을 사람이 읽기 좋은 라벨로 변환.
// 매핑에 없는 값(신규 카드 동기화로 늘어날 수 있음)은 원본 문자열을 그대로 보여준다.
const VARIANT_NAME_LABELS: Record<string, string> = {
  normal: "일반",
  holofoil: "홀로",
  unlimited: "무제한",
  unlimitedHolofoil: "무제한 홀로",
};

export function variantLabel(variantName: string): string {
  return VARIANT_NAME_LABELS[variantName] ?? variantName;
}

// 라우트 파라미터(문자열)를 카드 id로 파싱 — 양의 정수가 아니면 null.
export function parseCardId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export interface CardDetailResponse {
  id: number;
  externalId: string;
  name: string;
  nameKo?: string | null;
  // 언어(국가판) 코드 — CardResponse.languageCode와 동일(#263, EN/JA만 존재).
  languageCode: string;
  setName: string;
  rarity: string;
  supertype: string;
  types: string[];
  artist: string;
  printedNumber: string;
  imageSmall: string;
  imageMedium: string;
  imageLarge: string;
  // 일부 카드는 프로덕션 데이터에 이 필드가 없을 수 있어(#긴급 핫픽스) null 허용.
  viewCount: number | null;
  expansion: ExpansionSummary | null;
  variants: VariantSummary[];
}
