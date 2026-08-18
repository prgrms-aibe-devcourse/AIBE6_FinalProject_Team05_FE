"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { ApiError } from "@/lib/apiClient";
import { createInquiry, fetchMyInquiries } from "@/lib/inquiryApi";
import { INQUIRY_CATEGORIES, INQUIRY_CATEGORY_LABELS, InquiryCategory, InquiryResponse } from "@/types/inquiry";

type LoadState = "loading" | "ready" | "error";

const MAX_IMAGES = 3;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png"];

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

  const [activeCategory, setActiveCategory] = useState<InquiryCategory | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // File → 미리보기 URL 변환. images가 바뀔 때만 새로 만든다 (매 렌더 재생성 방지).
  const previews = useMemo(() => images.map((file) => URL.createObjectURL(file)), [images]);

  useEffect(() => {
    // previews가 바뀌기 전(이전 배치) URL을 해제해 메모리 누수를 막는다 - setState 없는 정리 전용 effect.
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, [previews]);

  const resetForm = () => {
    setTitle("");
    setContent("");
    setImages([]);
    setActiveCategory(null);
    setSubmitError("");
  };

  const handleSelectCategory = (category: InquiryCategory) => {
    setActiveCategory((prev) => (prev === category ? null : category));
    setSubmitError("");
  };

  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList) return;
    const files = Array.from(fileList);
    if (images.length + files.length > MAX_IMAGES) {
      setSubmitError(`이미지는 최대 ${MAX_IMAGES}장까지 첨부할 수 있습니다.`);
      return;
    }
    for (const file of files) {
      if (file.size > MAX_IMAGE_SIZE) {
        setSubmitError("이미지 용량은 5MB를 초과할 수 없습니다.");
        return;
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        setSubmitError("jpg 또는 png 이미지만 첨부할 수 있습니다.");
        return;
      }
    }
    setSubmitError("");
    setImages((prev) => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCategory || !title.trim() || !content.trim()) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      await createInquiry({ category: activeCategory, title: title.trim(), content: content.trim() }, images);
      resetForm();
      load();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "문의 접수에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="main-content mx-auto max-w-[720px] px-6 py-10">
      <div className="mb-6">
        <h1 className="mb-1 mt-0 text-2xl font-extrabold tracking-[-0.5px]">1:1 문의</h1>
        <p className="text-[13.5px] text-[#8A8A92]">유형을 선택하면 바로 문의를 작성할 수 있습니다</p>
      </div>

      <div className="mb-6 grid grid-cols-4 gap-2">
        {INQUIRY_CATEGORIES.map(({ value, label }) => {
          const active = activeCategory === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => handleSelectCategory(value)}
              className={`rounded-xl border-2 py-3 text-[13.5px] font-bold transition-colors ${
                active
                  ? "border-primary-dark bg-primary text-white shadow-tactile-sm"
                  : "border-[#EDEDF0] bg-white text-[#5A5A62] hover:border-[#DDDDE3]"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {activeCategory && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 flex flex-col gap-3 rounded-2xl border border-[#EDEDF0] bg-white p-6"
        >
          <div className="mb-1 text-[12.5px] font-bold text-primary">
            {INQUIRY_CATEGORY_LABELS[activeCategory]} 문의 작성
          </div>
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

          <div>
            <div className="mb-2 text-[12.5px] font-bold text-[#5A5A62]">사진 첨부 (최대 {MAX_IMAGES}장)</div>
            <div className="flex flex-wrap gap-2">
              {previews.map((src, i) => (
                <div key={i} className="relative h-[76px] w-[76px] overflow-hidden rounded-[10px] border border-[#EDEDF0]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- blob: object URL 미리보기라 next/image 최적화 대상이 아님 */}
                  <img src={src} alt={`첨부 이미지 ${i + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              {images.length < MAX_IMAGES && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-[76px] w-[76px] flex-col items-center justify-center gap-1 rounded-[10px] border-2 border-dashed border-[#DDDDE3] text-[#B4B4BC] hover:border-primary hover:text-primary"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  <span className="text-[11px] font-bold">{images.length}/{MAX_IMAGES}</span>
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              multiple
              className="hidden"
              onChange={(e) => handleFilesSelected(e.target.files)}
            />
          </div>

          {submitError && (
            <div className="text-[12.5px] font-semibold text-[#C21414]">{submitError}</div>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={resetForm}
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
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[#F2F2F5] px-2.5 py-1 text-[11px] font-bold text-[#5A5A62]">
                    {INQUIRY_CATEGORY_LABELS[inquiry.category]}
                  </span>
                  <h2 className="text-[14.5px] font-bold">{inquiry.title}</h2>
                </div>
                <span className="text-[11.5px] text-[#9A9AA2]">{formatDateTime(inquiry.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap text-[13.5px] leading-[1.6] text-[#4B4B52]">
                {inquiry.content}
              </p>
              {inquiry.imageUrls.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {inquiry.imageUrls.map((url, i) => (
                    // eslint-disable-next-line @next/next/no-img-element -- S3 presigned URL(만료 있음)이라 next/image 캐시 대상이 아님
                    <img
                      key={i}
                      src={url}
                      alt={`${inquiry.title} 첨부 이미지 ${i + 1}`}
                      className="h-[68px] w-[68px] rounded-[9px] border border-[#EDEDF0] object-cover"
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
