import { Grade } from "@/components/GradeBadge";

// 카드검색 API(BE) 응답 형태 — com.pokade.domain.card.dto.CardResponse 미러링.
export interface CardResponse {
  id: number;
  externalId: string;
  name: string;
  setName: string;
  rarity: string;
  supertype: string;
  types: string[];
  imageSmall: string;
  imageMedium: string;
  expansionId: string | null;
}

// 화면(카드 검색 그리드)이 쓰는 형태.
// grade/price는 CardResponse에 없는 필드 — 각각 등급진단/시세 API 연동 전까지 undefined.
export interface CardSearchItem {
  id: number;
  name: string;
  set: string;
  imageUrl: string;
  types: string[];
  grade?: Grade;
  price?: string;
}

export function toCardSearchItem(card: CardResponse): CardSearchItem {
  return {
    id: card.id,
    name: card.name,
    set: `${card.setName} · ${card.rarity}`,
    imageUrl: card.imageMedium || card.imageSmall,
    types: card.types,
    grade: undefined,
    price: undefined,
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
}

export interface CardDetailResponse {
  id: number;
  externalId: string;
  name: string;
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
  // 등급진단 API 연동 전까지 응답에 없는 필드 — undefined.
  grade?: Grade;
}
