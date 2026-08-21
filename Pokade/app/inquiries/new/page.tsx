"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { ApiError } from "@/lib/apiClient";
import { createInquiry } from "@/lib/inquiryApi";
import { INQUIRY_CATEGORIES, InquiryCategory } from "@/types/inquiry";

const MAX_IMAGES = 3;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png"];

export default function NewInquiryPage() {
  const router = useRouter();
  const status = useRequireAuth();

  const [category, setCategory] = useState<InquiryCategory | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File → 미리보기 URL 변환. images가 바뀔 때만 새로 만든다 (매 렌더 재생성 방지).
  const previews = useMemo(() => images.map((file) => URL.createObjectURL(file)), [images]);

  useEffect(() => {
    // previews가 바뀌기 전(이전 배치) URL을 해제해 메모리 누수를 막는다 - setState 없는 정리 전용 effect.
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, [previews]);

  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList) return;
    const files = Array.from(fileList);
    if (images.length + files.length > MAX_IMAGES) {
      setError(`이미지는 최대 ${MAX_IMAGES}장까지 첨부할 수 있습니다.`);
      return;
    }
    for (const file of files) {
      if (file.size > MAX_IMAGE_SIZE) {
        setError("이미지 용량은 5MB를 초과할 수 없습니다.");
        return;
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError("jpg 또는 png 이미지만 첨부할 수 있습니다.");
        return;
      }
    }
    setError(null);
    setImages((prev) => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!category) {
      setError("문의 유형을 선택해 주세요.");
      return;
    }
    if (!title.trim() || !content.trim()) {
      setError("제목과 내용을 모두 입력해 주세요.");
      return;
    }

    setSubmitting(true);
    try {
      await createInquiry({ category, title: title.trim(), content: content.trim() }, images);
      router.push("/mypage/inquiries");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "문의 접수에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (status !== "authenticated") return null;

  const inputCls =
    "w-full rounded-[11px] border border-[#DDDDE3] px-3.5 py-3 text-[14.5px] text-ink outline-none";

  return (
    <main className="main-content bg-neutral px-10 py-14">
      <div className="mx-auto w-full max-w-[560px] rounded-[18px] border border-[#EDEDF0] bg-white px-[34px] py-9 shadow-card">
        <h1 className="mb-6 text-[20px] font-extrabold tracking-[-0.5px]">문의 작성</h1>

        <form onSubmit={handleSubmit}>
          <label className="mb-[7px] block text-[13px] font-bold text-[#4B4B52]">문의 유형</label>
          <div className="flex flex-wrap gap-1.5">
            {INQUIRY_CATEGORIES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setCategory((prev) => (prev === value ? null : value))}
                className={`rounded-full border px-4 py-1.5 text-[12.5px] font-bold transition ${
                  category === value
                    ? "border-primary bg-primary text-white"
                    : "border-[#DDDDE3] bg-white text-[#4B4B52] hover:border-primary hover:text-primary"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="h-4" />

          <label htmlFor="title" className="mb-[7px] block text-[13px] font-bold text-[#4B4B52]">
            제목
          </label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목을 입력해 주세요"
            maxLength={200}
            className={inputCls}
          />

          <div className="h-4" />

          <label htmlFor="content" className="mb-[7px] block text-[13px] font-bold text-[#4B4B52]">
            내용
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="문의 내용을 입력해 주세요"
            rows={7}
            className={`${inputCls} resize-none`}
          />

          <div className="h-4" />

          <label className="mb-[7px] block text-[13px] font-bold text-[#4B4B52]">
            사진 첨부 (선택, 최대 {MAX_IMAGES}장)
          </label>
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

          {error && <p className="mt-4 text-[12.5px] font-semibold text-primary">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full rounded-[11px] border-2 border-primary-dark bg-primary py-3.5 text-[15.5px] font-bold text-white shadow-tactile transition active:translate-y-0.5 active:shadow-tactile-active disabled:opacity-60"
          >
            {submitting ? "접수 중..." : "문의 등록"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => router.back()}
          className="mt-3 w-full rounded-[11px] border-[1.5px] border-[#DDDDE3] bg-white py-3 text-[14px] font-bold text-[#4B4B52] transition hover:bg-[#F4F4F6]"
        >
          취소
        </button>
      </div>
    </main>
  );
}
