"use client";

import { useEffect, useState } from "react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { ApiError } from "@/lib/apiClient";
import { createInquiry, fetchMyInquiries } from "@/lib/inquiryApi";
import { InquiryResponse } from "@/types/inquiry";

type LoadState = "loading" | "ready" | "error";

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function InquiriesPage() {
  useRequireAuth();
  const [inquiries, setInquiries] = useState<InquiryResponse[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const load = () => {
    setLoadState("loading");
    fetchMyInquiries()
      .then((data) => {
        setInquiries(data);
        setLoadState("ready");
      })
      .catch((err) => {
        setErrorMessage(err instanceof ApiError ? err.message : "문의 목록을 불러오지 못했습니다.");
        setLoadState("error");
      });
  };

  useEffect(() => {
    // load()는 제출 후 재조회에도 재사용하는 공용 함수라 내부에서 setLoadState를 호출한다 - 의도적으로 유지.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      await createInquiry({ title: title.trim(), content: content.trim() });
      setTitle("");
      setContent("");
      setShowForm(false);
      load();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "문의 접수에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="main-content mx-auto max-w-[720px] px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="mb-1 mt-0 text-2xl font-extrabold tracking-[-0.5px]">1:1 문의</h1>
          <p className="text-[13.5px] text-[#8A8A92]">궁금한 점이나 불편한 점을 남겨주시면 확인 후 도와드립니다</p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-xl border-2 border-primary-dark bg-primary px-4 py-2.5 text-[13.5px] font-bold text-white shadow-tactile-sm"
          >
            새 문의 작성
          </button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 flex flex-col gap-3 rounded-2xl border border-[#EDEDF0] bg-white p-6"
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목"
            maxLength={200}
            className="rounded-[9px] border border-[#DDDDE3] px-3 py-2.5 text-[14px] outline-none focus:border-primary"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="문의 내용을 입력해주세요"
            rows={6}
            className="resize-none rounded-[9px] border border-[#DDDDE3] px-3 py-2.5 text-[14px] outline-none focus:border-primary"
          />
          {submitError && (
            <div className="text-[12.5px] font-semibold text-[#C21414]">{submitError}</div>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-xl border-[1.5px] border-[#DDDDE3] bg-white px-4 py-2.5 text-[13.5px] font-bold text-[#4B4B52]"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim() || !content.trim()}
              className="rounded-xl border-2 border-primary-dark bg-primary px-4 py-2.5 text-[13.5px] font-bold text-white shadow-tactile-sm disabled:opacity-60"
            >
              {submitting ? "접수 중..." : "제출"}
            </button>
          </div>
        </form>
      )}

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
        <div className="flex flex-col gap-3">
          {inquiries.map((inquiry) => (
            <div key={inquiry.id} className="rounded-2xl border border-[#EDEDF0] bg-white p-5">
              <div className="mb-1 flex items-center justify-between">
                <h2 className="text-[14.5px] font-bold">{inquiry.title}</h2>
                <span className="text-[11.5px] text-[#9A9AA2]">{formatDateTime(inquiry.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap text-[13.5px] leading-[1.6] text-[#4B4B52]">
                {inquiry.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
