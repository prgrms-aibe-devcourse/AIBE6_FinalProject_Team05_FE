// com.pokade.domain.inquiry.entity.InquiryCategory 미러링.
export type InquiryCategory = "INFO" | "SECURITY" | "PAYMENT" | "ETC";

export const INQUIRY_CATEGORIES: { value: InquiryCategory; label: string }[] = [
  { value: "INFO", label: "정보" },
  { value: "SECURITY", label: "보안" },
  { value: "PAYMENT", label: "결제" },
  { value: "ETC", label: "기타" },
];

export const INQUIRY_CATEGORY_LABELS: Record<InquiryCategory, string> = {
  INFO: "정보",
  SECURITY: "보안",
  PAYMENT: "결제",
  ETC: "기타",
};

// com.pokade.domain.inquiry.entity.InquiryStatus 미러링.
export type InquiryStatus = "UNHANDLED" | "HANDLED";

export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  UNHANDLED: "미확인",
  HANDLED: "처리완료",
};

// com.pokade.domain.inquiry.dto.response.InquiryResponse 미러링.
export interface InquiryResponse {
  id: number;
  userId: number;
  category: InquiryCategory;
  status: InquiryStatus;
  title: string;
  content: string;
  imageUrls: string[];
  createdAt: string;
  answerContent: string | null;
  answeredAt: string | null;
}

// POST /api/inquiries의 "request" 파트 — com.pokade.domain.inquiry.dto.request.InquiryCreateRequest 미러링.
export interface InquiryCreateRequest {
  category: InquiryCategory;
  title: string;
  content: string;
}

// PATCH /api/inquiries/{id} 요청 본문 — com.pokade.domain.inquiry.dto.request.InquiryUpdateRequest 미러링.
// 첨부 이미지는 이번 범위에서 수정 대상이 아니다(등록 시점 그대로 유지).
export interface InquiryUpdateRequest {
  category: InquiryCategory;
  title: string;
  content: string;
}
