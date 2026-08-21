import { Grade } from "@/components/GradeBadge";

// AI 등급 진단 API(BE) 응답 형태 — com.pokade.domain.ai.dto.GradeResponse 미러링.
// POST /api/ai/grade, GET /api/ai/grade/{resultId}, GET /api/ai/grade/history 모두 동일한 형태.
export type GradeStatus = "SUCCESS" | "QUALITY_FAIL";

export interface GradeResponse {
  gradeResultId: number;
  status: GradeStatus;
  grade: Grade | null;
  centeringScore: number | null;
  edgeScore: number | null;
  surfaceScore: number | null;
  cornerScore: number | null;
  confidence: number | null;
  isFree: boolean;
  pointUsed: number;
  retryAllowed: boolean;
  notice: string;
  createdAt: string;
  // vision_card_id(externalId)로 해석된 카드 — 자체 DB에 없거나 인식 실패면 전부 null.
  // cardId가 있어야 FR-AI-04(도감 등록)를 진행할 수 있다.
  cardId: number | null;
  cardName: string | null;
  cardImageSmall: string | null;
  // 카드 인식 신뢰도(%) — 등급 산출 신뢰도(confidence)와는 별개 지표.
  cardConfidence: number | null;
}
