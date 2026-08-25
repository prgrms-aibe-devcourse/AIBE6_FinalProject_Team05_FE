import { apiDelete, apiGet, apiPatch, apiPostForm } from "@/lib/apiClient";
import { InquiryCreateRequest, InquiryResponse, InquiryUpdateRequest } from "@/types/inquiry";

// POST /api/inquiries — 로그인 필요(401 가능). 첨부 이미지는 최대 3장.
export async function createInquiry(
  request: InquiryCreateRequest,
  images: File[],
): Promise<InquiryResponse> {
  const formData = new FormData();
  formData.append("request", new Blob([JSON.stringify(request)], { type: "application/json" }));
  images.forEach((file) => formData.append("images", file));
  return apiPostForm<InquiryResponse>("/api/inquiries", formData);
}

// GET /api/inquiries/me — 본인이 작성한 문의 목록, 최신순.
export async function fetchMyInquiries(): Promise<InquiryResponse[]> {
  return apiGet<InquiryResponse[]>("/api/inquiries/me");
}

// PATCH /api/inquiries/{id} — 본인 소유 + 답변 전(UNHANDLED) 문의만 수정 가능(BE에서 검증).
export async function updateInquiry(
  id: number,
  request: InquiryUpdateRequest,
): Promise<InquiryResponse> {
  return apiPatch<InquiryResponse>(`/api/inquiries/${id}`, request);
}

// DELETE /api/inquiries/{id} — 본인 소유 + 답변 전(UNHANDLED) 문의만 삭제 가능(BE에서 검증).
export async function deleteInquiry(id: number): Promise<void> {
  return apiDelete(`/api/inquiries/${id}`);
}
