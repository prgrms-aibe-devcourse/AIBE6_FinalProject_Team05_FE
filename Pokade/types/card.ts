// 카드검색 API(BE) 응답 형태 — com.pokade.domain.card.dto.CardResponse 미러링.
export interface CardResponse {
  id: number;
  externalId: string;
  name: string;
  nameKo?: string | null;
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
}

// GET /api/cards/facets 응답 — 검색 필터(세트/타입/레어도) 체크박스가 쓰는 옵션 목록.
export interface CardFacetsResponse {
  types: string[];
  rarities: string[];
  expansions: { id: string; name: string }[];
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
  setName: string;
  rarity: string;
  supertype: string;
  types: string[];
  artist: string;
  printedNumber: string;
  imageSmall: string;
  imageMedium: string;
  imageLarge: string;
  expansion: ExpansionSummary | null;
  variants: VariantSummary[];
}
