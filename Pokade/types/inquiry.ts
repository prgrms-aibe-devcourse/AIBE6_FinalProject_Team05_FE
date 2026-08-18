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

// com.pokade.domain.inquiry.dto.response.InquiryResponse 미러링.
export interface InquiryResponse {
  id: number;
  userId: number;
  category: InquiryCategory;
  title: string;
  content: string;
  imageUrls: string[];
  createdAt: string;
}

// POST /api/inquiries의 "request" 파트 — com.pokade.domain.inquiry.dto.request.InquiryCreateRequest 미러링.
export interface InquiryCreateRequest {
  category: InquiryCategory;
  title: string;
  content: string;
}
