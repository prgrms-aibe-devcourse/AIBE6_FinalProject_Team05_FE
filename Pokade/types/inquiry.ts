// com.pokade.domain.inquiry.dto.response.InquiryResponse 미러링.
export interface InquiryResponse {
  id: number;
  userId: number;
  title: string;
  content: string;
  createdAt: string;
}

// POST /api/inquiries 요청 바디 — com.pokade.domain.inquiry.dto.request.InquiryCreateRequest 미러링.
export interface InquiryCreateRequest {
  title: string;
  content: string;
}
