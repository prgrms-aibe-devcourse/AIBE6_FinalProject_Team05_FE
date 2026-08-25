// 카드검색 API(BE) 응답 형태 — com.pokade.domain.card.dto.CardResponse 미러링.
export interface CardResponse {
  id: number;
  externalId: string;
  name: string;
  nameKo?: string | null;
  // 언어(국가판) 코드 — 실제 존재 값은 EN/JA뿐(#263, 다른 값 없음 확인됨).
  languageCode: string;
  // BE Card 엔티티에 nullable=false가 없어 둘 다 null로 내려올 수 있다(실데이터 확인) —
  // 화면에서 이어붙일 때는 formatSetAndRarity를 써서 구분자만 남지 않게 한다.
  setName: string | null;
  rarity: string | null;
  supertype: string;
  // 실데이터에 types가 null인 카드가 존재한다(#235에서 확인 — 시드 외 대량 카탈로그 구간).
  // 빈 배열과 구분 없이 쓰이므로 읽는 쪽에서 항상 ?? []로 좁혀서 쓴다(toCardSearchItem 참고).
  types: string[] | null;
  imageSmall: string;
  imageMedium: string;
  expansionId: string | null;
  // 판매 중인 매물의 등급 목록. BE가 GRADE_DISPLAY_ORDER(S>A>B) 순으로 정렬해서 내려준다.
  // 매물이 없으면 빈 배열 — 다만 types와 같은 이유로 null 가능성을 열어둔다.
  grades: string[] | null;
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

// 세트 · 레어도를 한 줄로 잇는 공통 표기. 둘 다 nullable이라 직접 이으면 문자열이 깨진다 —
// 템플릿 리터럴은 "null · null"을 찍고, JSX({a} · {b})는 null을 안 그리는 대신 구분자만 남은
// " · "를 남긴다. 있는 값만 골라 잇고 둘 다 없으면 빈 문자열 — 소비처가 모두 텍스트로만
// 렌더해 빈 값이 안전하다.
export function formatSetAndRarity(setName: string | null, rarity: string | null): string {
  return [setName, rarity].filter(Boolean).join(" · ");
}

export function toCardSearchItem(card: CardResponse): CardSearchItem {
  return {
    id: card.id,
    name: card.nameKo ?? card.name,
    nameEn: card.name,
    nameKo: card.nameKo,
    // 바로 아래 types와 같은 이유의 방어 — BE null을 FE 경계에서 한 번에 좁힌다.
    set: formatSetAndRarity(card.setName, card.rarity),
    imageUrl: card.imageMedium || card.imageSmall,
    // BE가 null을 내려보내는 카드가 있어(#235) 여기서 한 번에 빈 배열로 좁힌다 — 이후 화면
    // 코드(SearchResultsView 등)는 CardSearchItem의 non-null 배열만 보면 되도록 유지한다.
    types: card.types ?? [],
    grades: card.grades ?? [],
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

// 세트(확장팩) 이름도 BE가 Scrydex 원본(영문)을 그대로 내려준다. "151"이나 "Pokemon GO"처럼
// 이미 널리 알려진 이름은 그대로 두고, "Base"처럼 무슨 세트인지 감이 안 오는 이름만 번역한다.
// 매핑에 없는 값(신규 세트 동기화로 늘어날 수 있음)은 원본 문자열을 그대로 보여준다.
const SET_NAME_LABELS: Record<string, string> = {
  Base: "베이스",
  "Black Bolt": "블랙 볼트",
  "Unified Minds": "하나로 이어진 마음",
  "Ancient Origins": "고대의 기원",
  "Burning Shadows": "불타는 그림자",
  "Mega Evolution": "메가진화",
};

export function setNameKo(setName: string): string {
  return SET_NAME_LABELS[setName] ?? setName;
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
  // 실제로는 CardResponse.setName/rarity와 같은 컬럼이라 BE에서 null이 올 수 있다. 다만 타입을
  // 넓히면 이 응답을 쓰는 다른 도메인 화면(상품 등록/포트폴리오)의 매퍼까지 함께 고쳐야 해서
  // 여기서는 선언을 그대로 두고, 이 응답을 읽는 쪽에서 formatSetAndRarity로 방어한다.
  setName: string;
  rarity: string;
  supertype: string;
  // CardResponse.types와 같은 이유로 null 가능(#235) — 상세 API도 동일 카드에서 null을 내려준다.
  types: string[] | null;
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
