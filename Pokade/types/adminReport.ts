// com.pokade.domain.report.entity.ReportTargetType 미러링.
export type ReportTargetType = "LISTING" | "USER" | "TRADE";

// com.pokade.domain.report.entity.ReportStatus 미러링.
export type ReportStatus = "PENDING" | "REVIEWED" | "ACCEPTED" | "DISMISSED";

// GET /api/admin/reports 응답 항목 — com.pokade.domain.report.dto.ReportResponse 미러링.
// 매물(LISTING) 신고만 내려준다(targetType은 항상 "LISTING").
export interface ReportResponse {
  id: number;
  targetType: ReportTargetType;
  targetId: number;
  reporterId: number;
  reason: string | null;
  status: ReportStatus;
  createdAt: string;
}
