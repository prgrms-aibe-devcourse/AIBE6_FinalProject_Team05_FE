import { apiGet, apiPost } from "@/lib/apiClient";
import { InquiryCreateRequest, InquiryResponse } from "@/types/inquiry";

// POST /api/inquiries — 로그인 필요(401 가능).
export async function createInquiry(request: InquiryCreateRequest): Promise<InquiryResponse> {
  return apiPost<InquiryResponse>("/api/inquiries", request);
}

// GET /api/inquiries/me — 본인이 작성한 문의 목록, 최신순.
export async function fetchMyInquiries(): Promise<InquiryResponse[]> {
  return apiGet<InquiryResponse[]>("/api/inquiries/me");
}
