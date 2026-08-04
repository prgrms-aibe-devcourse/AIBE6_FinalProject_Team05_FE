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
}
