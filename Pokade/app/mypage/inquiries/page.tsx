"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { ApiError } from "@/lib/apiClient";
import { fetchMyInquiries } from "@/lib/inquiryApi";
import { INQUIRY_CATEGORY_LABELS, INQUIRY_STATUS_LABELS, InquiryResponse } from "@/types/inquiry";

type LoadState = "loading" | "ready" | "error";

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function statusBadgeCls(status: InquiryResponse["status"]) {
  return status === "HANDLED" ? "bg-[#E8F7EF] text-[#059669]" : "bg-[#FFF1F1] text-[#C21414]";
}

export default function MyInquiriesPage() {
  const status = useRequireAuth();
  const [inquiries, setInquiries] = useState<InquiryResponse[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [selected, setSelected] = useState<InquiryResponse | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetchMyInquiries()
      .then((data) => {
        setInquiries(data);
        setLoadState("ready");
      })
      .catch((err) => {
        setErrorMessage(err instanceof ApiError ? err.message : "문의 목록을 불러오지 못했습니다.");
        setLoadState("error");
      });
  }, [status]);

  if (status !== "authenticated") return null;

  return (
    <>
      <main className="main-content bg-neutral px-10 py-12">
        <div className="mx-auto w-full max-w-[880px]">
          <Link
            href="/mypage"
            className="mb-4 inline-block text-[13px] font-semibold text-[#8A8A92] hover:text-primary"
          >
            ← 마이페이지
          </Link>

          <div className="mb-5 flex items-center justify-between">
            <h1 className="m-0 text-[22px] font-extrabold tracking-[-0.5px]">1:1 문의 내역</h1>
            <Link
              href="/inquiries/new"
              className="rounded-[11px] border-2 border-primary-dark bg-primary px-4 py-2.5 text-[13.5px] font-bold text-white shadow-tactile-sm transition active:translate-y-0.5"
            >
              문의 작성
            </Link>
          </div>

          {loadState === "loading" && (
            <div className="rounded-[14px] border border-[#EDEDF0] bg-white px-6 py-14 text-center text-[13.5px] text-[#8A8A92]">
              불러오는 중...
            </div>
          )}

          {loadState === "error" && (
            <div className="rounded-[14px] border border-[#F6C6C6] bg-[#FFF1F1] px-6 py-6 text-center text-[13.5px] text-[#C21414]">
              {errorMessage}
            </div>
          )}

          {loadState === "ready" && inquiries.length === 0 && (
            <div className="rounded-[14px] border border-[#EDEDF0] bg-white px-6 py-14 text-center text-[13.5px] text-[#8A8A92]">
              작성한 문의가 없습니다.
            </div>
          )}

          {loadState === "ready" && inquiries.length > 0 && (
            <div className="overflow-hidden rounded-[14px] border border-[#EDEDF0] bg-white">
              <div className="grid grid-cols-[0.5fr_0.8fr_1.8fr_0.8fr_1fr] gap-3.5 border-b border-[#EDEDF0] bg-[#FAFAFB] px-[22px] py-[13px] text-xs font-bold text-[#9A9AA2]">
                <div>번호</div>
                <div>유형</div>
                <div>제목</div>
                <div>상태</div>
                <div>접수</div>
              </div>
              {inquiries.map((inquiry) => (
                <div
                  key={inquiry.id}
                  onClick={() => setSelected(inquiry)}
                  className="grid cursor-pointer grid-cols-[0.5fr_0.8fr_1.8fr_0.8fr_1fr] items-center gap-3.5 border-b border-[#F2F2F5] px-[22px] py-[15px] text-[13.5px] last:border-b-0 hover:bg-[#FAFAFB]"
                >
                  <div className="font-bold text-secondary">#{inquiry.id}</div>
                  <div>
                    <span className="rounded-full bg-[#F2F2F5] px-2.5 py-1 text-[11px] font-bold text-[#5A5A62]">
                      {INQUIRY_CATEGORY_LABELS[inquiry.category]}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    {inquiry.title}
                    {inquiry.imageUrls.length > 0 && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#B4B4BC" strokeWidth="2" className="flex-shrink-0">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="M21 15l-5-5L5 21" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusBadgeCls(inquiry.status)}`}>
                      {INQUIRY_STATUS_LABELS[inquiry.status]}
                    </span>
                  </div>
                  <div className="text-[#9A9AA2]">{formatDateTime(inquiry.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* slide-in panel */}
      <div
        onClick={() => setSelected(null)}
        className="fixed inset-0 z-[70] bg-navy/35 transition-opacity duration-300"
        style={{ opacity: selected ? 1 : 0, pointerEvents: selected ? "auto" : "none" }}
      />
      <aside
        className="fixed bottom-0 right-0 top-0 z-[80] flex w-[420px] max-w-[92vw] flex-col overflow-y-auto bg-white shadow-panel transition-transform duration-300"
        style={{ transform: selected ? "translateX(0)" : "translateX(100%)" }}
      >
        {selected && (
          <>
            <div className="flex items-center justify-between border-b border-[#EDEDF0] px-6 py-[22px]">
              <div>
                <div className="text-xs font-semibold text-[#9A9AA2]">문의 상세</div>
                <div className="text-lg font-extrabold text-secondary">#{selected.id}</div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-[#F2F2F5] hover:bg-[#E4E4E9]"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4B4B52" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex flex-col gap-5 p-6">
              <div className="flex items-center gap-2">
                <span className="inline-block rounded-full bg-[#F2F2F5] px-2.5 py-1 text-[11.5px] font-bold text-[#5A5A62]">
                  {INQUIRY_CATEGORY_LABELS[selected.category]}
                </span>
                <span className={`inline-block rounded-full px-2.5 py-1 text-[11.5px] font-bold ${statusBadgeCls(selected.status)}`}>
                  {INQUIRY_STATUS_LABELS[selected.status]}
                </span>
              </div>
              <div>
                <div className="mb-1.5 text-xs font-bold text-[#9A9AA2]">제목</div>
                <p className="m-0 text-[15px] font-bold">{selected.title}</p>
              </div>
              <div>
                <div className="mb-1.5 text-xs font-bold text-[#9A9AA2]">접수일</div>
                <p className="m-0 text-[13.5px] text-[#5A5A62]">{formatDateTime(selected.createdAt)}</p>
              </div>
              <div>
                <div className="mb-1.5 text-xs font-bold text-[#9A9AA2]">내용</div>
                <p className="m-0 whitespace-pre-wrap text-[13.5px] leading-[1.6] text-[#4B4B52]">
                  {selected.content}
                </p>
              </div>
              {selected.imageUrls.length > 0 && (
                <div>
                  <div className="mb-1.5 text-xs font-bold text-[#9A9AA2]">첨부 이미지</div>
                  <div className="flex flex-wrap gap-2">
                    {selected.imageUrls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element -- S3 presigned URL(만료 있음)이라 next/image 캐시 대상이 아님 */}
                        <img
                          src={url}
                          alt={`${selected.title} 첨부 이미지 ${i + 1}`}
                          className="h-[92px] w-[92px] rounded-[10px] border border-[#EDEDF0] object-cover"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </aside>
    </>
  );
}
