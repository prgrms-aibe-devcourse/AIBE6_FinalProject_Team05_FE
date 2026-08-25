"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import AdminSidebar from "@/components/AdminSidebar";
import Toast from "@/components/Toast";
import { useToast } from "@/hooks/useToast";
import { answerInquiry, fetchInquiries, fetchInquiry, updateInquiryStatus } from "@/lib/adminApi";
import { ApiError } from "@/lib/apiClient";
import {
  INQUIRY_CATEGORIES,
  INQUIRY_CATEGORY_LABELS,
  INQUIRY_STATUS_LABELS,
  InquiryCategory,
  InquiryResponse,
} from "@/types/inquiry";

type LoadState = "loading" | "ready" | "error";
const PAGE_SIZE = 20;

// "yyyy-MM-ddTHH:mm:ss" → "YYYY.MM.DD HH:mm" (다른 어드민 화면들과 동일한 표시 규칙).
function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function statusBadgeCls(status: InquiryResponse["status"]) {
  return status === "HANDLED"
    ? "bg-[#E8F7EF] text-[#059669]"
    : "bg-[#FFF1F1] text-[#C21414]";
}

export default function AdminInquiriesPage() {
  return (
    <Suspense fallback={null}>
      <AdminInquiriesView />
    </Suspense>
  );
}

function AdminInquiriesView() {
  const searchParams = useSearchParams();
  // 알림("새 문의가 접수되었습니다")을 눌러 들어온 경우 ?inquiryId=로 특정 문의를 바로 펼친다.
  // 목록은 페이지네이션이 있어 그 문의가 지금 보이는 페이지에 없을 수 있으므로, 목록에서 찾지
  // 않고 상세 조회 API로 직접 가져온다. 최초 1회만 시도한다.
  const inquiryIdParam = searchParams.get("inquiryId");
  const didAutoOpenRef = useRef(false);

  const { toast, showToast, pauseToast, resumeToast } = useToast();

  const [inquiries, setInquiries] = useState<InquiryResponse[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [selected, setSelected] = useState<InquiryResponse | null>(null);

  const [category, setCategory] = useState<InquiryCategory | null>(null);
  const [page, setPage] = useState(1); // 1-based (UI) — API 호출 시 -1
  const [totalPages, setTotalPages] = useState(1);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const [answerDraft, setAnswerDraft] = useState("");
  const [answerSubmitting, setAnswerSubmitting] = useState(false);
  const [answerError, setAnswerError] = useState("");

  // 상세 패널에서 다른 문의로 선택이 바뀌면 답변 초안도 그 문의의 기존 답변으로 리셋한다.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnswerDraft(selected?.answerContent ?? "");
    setAnswerError("");
  }, [selected?.id, selected?.answerContent]);

  useEffect(() => {
    let cancelled = false;
    // 필터/페이지 변경 시마다 로딩 상태로 재설정 후 재조회 - 의도적으로 유지.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadState("loading");
    fetchInquiries({ category: category ?? undefined, page: page - 1, size: PAGE_SIZE })
      .then((data) => {
        if (cancelled) return;
        setInquiries(data.content);
        setTotalPages(Math.max(1, data.totalPages));
        setLoadState("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMessage(err instanceof ApiError ? err.message : "문의 목록을 불러오지 못했습니다.");
        setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [category, page]);

  useEffect(() => {
    if (didAutoOpenRef.current || inquiryIdParam == null) return;
    didAutoOpenRef.current = true;
    fetchInquiry(Number(inquiryIdParam))
      .then((inquiry) => setSelected(inquiry))
      .catch(() => {
        // 이미 삭제됐거나 조회 실패 - 조용히 무시하고 목록 화면은 그대로 둔다.
      });
  }, [inquiryIdParam]);

  const handleSelectCategory = (next: InquiryCategory | null) => {
    setCategory(next);
    setPage(1);
  };

  const applyStatus = (id: number, updated: InquiryResponse) => {
    setInquiries((prev) => prev.map((inq) => (inq.id === id ? updated : inq)));
    setSelected((prev) => (prev && prev.id === id ? updated : prev));
  };

  const handleToggleStatus = async () => {
    if (!selected || statusUpdating) return;
    const nextStatus = selected.status === "HANDLED" ? "UNHANDLED" : "HANDLED";
    setStatusUpdating(true);
    try {
      const updated = await updateInquiryStatus(selected.id, nextStatus);
      applyStatus(selected.id, updated);
    } catch {
      // 토글 실패는 조용히 무시 - 상세 패널은 그대로 열려 있으니 재시도 가능
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!selected || answerSubmitting || !answerDraft.trim()) return;
    // 성공 토스트 문구를 등록/수정으로 가르기 위해 호출 전 상태를 미리 기억해 둔다 -
    // applyStatus가 selected를 갈아 끼운 뒤에는 "원래 답변이 있었는지"를 알 수 없다.
    const wasAlreadyAnswered = selected.answerContent != null;
    setAnswerSubmitting(true);
    setAnswerError("");
    try {
      const updated = await answerInquiry(selected.id, answerDraft.trim());
      applyStatus(selected.id, updated);
      showToast({ message: wasAlreadyAnswered ? "답변이 수정되었습니다." : "답변이 등록되었습니다." });
    } catch (err) {
      // 답변은 사용자가 직접 작성한 내용이라 상태 토글과 달리 실패를 조용히 무시하지 않는다 - 재시도할 수 있게 에러를 보여준다
      setAnswerError(err instanceof ApiError ? err.message : "답변 등록에 실패했습니다.");
    } finally {
      setAnswerSubmitting(false);
    }
  };

  return (
    <>
      <main className="main-content flex bg-neutral">
        <AdminSidebar />

        <div className="min-w-0 flex-1 px-9 py-8">
          <h1 className="mb-1 mt-0 text-2xl font-extrabold tracking-[-0.5px]">1:1 문의 관리</h1>
          <p className="mb-[18px] text-[13.5px] text-[#8A8A92]">
            사용자가 접수한 1:1 문의를 확인합니다
          </p>

          <div className="mb-4 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => handleSelectCategory(null)}
              className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition ${
                category === null
                  ? "border-primary bg-primary text-white"
                  : "border-[#DDDDE3] bg-white text-[#4B4B52] hover:border-primary hover:text-primary"
              }`}
            >
              전체
            </button>
            {INQUIRY_CATEGORIES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleSelectCategory(value)}
                className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition ${
                  category === value
                    ? "border-primary bg-primary text-white"
                    : "border-[#DDDDE3] bg-white text-[#4B4B52] hover:border-primary hover:text-primary"
                }`}
              >
                {label}
              </button>
            ))}
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
              접수된 문의가 없습니다.
            </div>
          )}

          {loadState === "ready" && inquiries.length > 0 && (
            <>
              <div className="overflow-hidden rounded-[14px] border border-[#EDEDF0] bg-white">
                <div className="grid grid-cols-[0.5fr_0.7fr_1.4fr_0.7fr_0.8fr_1fr] gap-3.5 border-b border-[#EDEDF0] bg-[#FAFAFB] px-[22px] py-[13px] text-xs font-bold text-[#9A9AA2]">
                  <div>번호</div>
                  <div>유형</div>
                  <div>제목</div>
                  <div>작성자</div>
                  <div>상태</div>
                  <div>접수</div>
                </div>
                {inquiries.map((inquiry) => (
                  <div
                    key={inquiry.id}
                    onClick={() => setSelected(inquiry)}
                    className="grid cursor-pointer grid-cols-[0.5fr_0.7fr_1.4fr_0.7fr_0.8fr_1fr] items-center gap-3.5 border-b border-[#F2F2F5] px-[22px] py-[15px] text-[13.5px] last:border-b-0 hover:bg-[#FAFAFB]"
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
                    <div className="text-[#5A5A62]">#{inquiry.userId}</div>
                    <div>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusBadgeCls(inquiry.status)}`}>
                        {INQUIRY_STATUS_LABELS[inquiry.status]}
                      </span>
                    </div>
                    <div className="text-[#9A9AA2]">{formatDateTime(inquiry.createdAt)}</div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-5 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-[#DDDDE3] bg-white text-[13px] font-bold text-[#4B4B52] enabled:hover:border-primary enabled:hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    &lt;
                  </button>
                  <span className="text-[13px] font-semibold text-[#5A5A62]">
                    {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-[#DDDDE3] bg-white text-[13px] font-bold text-[#4B4B52] enabled:hover:border-primary enabled:hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    &gt;
                  </button>
                </div>
              )}
            </>
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
                <div className="mb-1.5 text-xs font-bold text-[#9A9AA2]">작성자 / 접수일</div>
                <p className="m-0 text-[13.5px] text-[#5A5A62]">
                  #{selected.userId} · {formatDateTime(selected.createdAt)}
                </p>
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

              <div className="border-t border-[#EDEDF0] pt-5">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-bold text-[#9A9AA2]">답변</span>
                  {selected.answeredAt && (
                    <span className="text-[11.5px] text-[#B4B4BC]">
                      {formatDateTime(selected.answeredAt)} 답변
                    </span>
                  )}
                </div>
                <textarea
                  value={answerDraft}
                  onChange={(e) => setAnswerDraft(e.target.value)}
                  placeholder="사용자에게 전달할 답변을 입력하세요"
                  rows={5}
                  className="w-full resize-none rounded-[10px] border border-[#DDDDE3] px-3.5 py-3 text-[13.5px] leading-[1.6] text-[#2B2B31] outline-none focus:border-primary"
                />
                {answerError && (
                  <p className="mt-1.5 text-[12.5px] text-[#C21414]">{answerError}</p>
                )}
                <button
                  type="button"
                  onClick={handleSubmitAnswer}
                  disabled={answerSubmitting || !answerDraft.trim()}
                  className="mt-2.5 w-full rounded-[11px] border-2 border-primary-dark bg-primary py-3 text-[14px] font-bold text-white shadow-tactile-sm transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {answerSubmitting ? "등록 중..." : selected.answerContent ? "답변 수정" : "답변 등록"}
                </button>
              </div>

              <button
                type="button"
                onClick={handleToggleStatus}
                disabled={statusUpdating}
                className={`mt-1 w-full rounded-[11px] border-2 py-3 text-[14px] font-bold transition disabled:opacity-60 ${
                  selected.status === "HANDLED"
                    ? "border-[#DDDDE3] bg-white text-[#4B4B52] hover:bg-[#F4F4F6]"
                    : "border-primary-dark bg-primary text-white shadow-tactile-sm"
                }`}
              >
                {statusUpdating
                  ? "처리 중..."
                  : selected.status === "HANDLED"
                    ? "미확인으로 되돌리기"
                    : "처리 완료로 표시"}
              </button>
            </div>
          </>
        )}
      </aside>
      {/* 상세 패널(aside, z-[80])이 열려 있을 때도 토스트가 그 위에 보여야 한다 - 기본 z-50이면
          패널 뒤에 깔려 안 보인다(실제 보고된 문제). */}
      <Toast toast={toast} onPause={pauseToast} onResume={resumeToast} zIndexClassName="z-[90]" />
    </>
  );
}
