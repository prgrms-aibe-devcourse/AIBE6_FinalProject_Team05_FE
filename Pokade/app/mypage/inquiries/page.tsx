"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { ApiError } from "@/lib/apiClient";
import { deleteInquiry, fetchMyInquiries, updateInquiry } from "@/lib/inquiryApi";
import {
  INQUIRY_CATEGORIES,
  INQUIRY_CATEGORY_LABELS,
  INQUIRY_STATUS_LABELS,
  InquiryCategory,
  InquiryResponse,
} from "@/types/inquiry";
import { useNotificationStore } from "@/store/useNotificationStore";

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

  // 수정 폼 상태 - 상세 패널 안에서 보기/수정 모드를 토글한다(별도 페이지로 안 뺀다).
  const [isEditing, setIsEditing] = useState(false);
  const [editCategory, setEditCategory] = useState<InquiryCategory | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  // 실수로 바로 지워지지 않도록 삭제는 2단계 확인(먼저 누르면 "정말 삭제하시겠습니까?"로
  // 바뀌고, 그때 다시 누르면 실제로 삭제된다) - 워치리스트 삭제와 동일한 패턴.
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [actionError, setActionError] = useState("");

  // 관리자 답변 알림(SSE)이 도착하면 새로고침 없이 목록/상세를 다시 불러온다.
  // arrivalSeq는 "진짜 새로 도착한 알림"일 때만 오르므로(#235 - 초기 로드/폴링 교체는 안 건드림),
  // 0(아직 도착한 적 없음, 초기 렌더)이면 건드리지 않는다.
  const arrivalSeq = useNotificationStore((s) => s.arrivalSeq);
  const latestNotification = useNotificationStore((s) => s.notifications[0]);

  // 화면엔 DB의 실제 문의 id 대신 "몇 번째로 등록한 문의인지"를 유저별로 보여준다 —
  // 등록순(id 오름차순)으로 1부터 번호를 매긴다. 목록 자체는 최신순(내림차순) 정렬을 유지한다.
  const sequenceNumberById = useMemo(() => {
    const byRegisteredOrder = [...inquiries].sort((a, b) => a.id - b.id);
    return new Map(byRegisteredOrder.map((inquiry, i) => [inquiry.id, i + 1]));
  }, [inquiries]);

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

  useEffect(() => {
    if (status !== "authenticated") return;
    if (arrivalSeq === 0) return; // 초기 렌더 - 아직 실시간 알림이 온 적 없음
    if (latestNotification?.type !== "INQUIRY_HANDLED") return;

    fetchMyInquiries()
      .then((data) => {
        setInquiries(data);
        // 지금 상세 패널이 열려 있던 문의라면, 방금 받은 답변까지 그 자리에서 바로 보이게 갱신한다.
        setSelected((prev) => {
          if (prev == null) return prev;
          return data.find((inquiry) => inquiry.id === prev.id) ?? prev;
        });
      })
      .catch(() => {
        // 목록 갱신 실패는 조용히 무시 - 기존 목록을 그대로 유지하고, 다음 알림이나
        // 수동 새로고침에서 다시 시도된다.
      });
  }, [arrivalSeq, latestNotification, status]);

  const startEdit = (inquiry: InquiryResponse) => {
    setEditCategory(inquiry.category);
    setEditTitle(inquiry.title);
    setEditContent(inquiry.content);
    setActionError("");
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setActionError("");
  };

  const handleSaveEdit = () => {
    if (selected == null || editCategory == null || !editTitle.trim() || !editContent.trim()) {
      setActionError("문의 유형·제목·내용을 모두 입력해주세요.");
      return;
    }
    setIsSaving(true);
    setActionError("");
    updateInquiry(selected.id, { category: editCategory, title: editTitle, content: editContent })
      .then((updated) => {
        setInquiries((prev) => prev.map((inquiry) => (inquiry.id === updated.id ? updated : inquiry)));
        setSelected(updated);
        setIsEditing(false);
      })
      .catch((err) => {
        setActionError(err instanceof ApiError ? err.message : "문의 수정에 실패했습니다.");
      })
      .finally(() => setIsSaving(false));
  };

  const handleDeleteClick = () => {
    if (selected == null) return;
    if (!deleteConfirming) {
      setDeleteConfirming(true);
      return;
    }
    setIsSaving(true);
    setActionError("");
    deleteInquiry(selected.id)
      .then(() => {
        setInquiries((prev) => prev.filter((inquiry) => inquiry.id !== selected.id));
        setSelected(null);
        setDeleteConfirming(false);
      })
      .catch((err) => {
        setActionError(err instanceof ApiError ? err.message : "문의 삭제에 실패했습니다.");
        setDeleteConfirming(false);
      })
      .finally(() => setIsSaving(false));
  };

  const closePanel = () => {
    setSelected(null);
    setIsEditing(false);
    setDeleteConfirming(false);
    setActionError("");
  };

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
                  onClick={() => {
                    setSelected(inquiry);
                    setIsEditing(false);
                    setDeleteConfirming(false);
                    setActionError("");
                  }}
                  className="grid cursor-pointer grid-cols-[0.5fr_0.8fr_1.8fr_0.8fr_1fr] items-center gap-3.5 border-b border-[#F2F2F5] px-[22px] py-[15px] text-[13.5px] last:border-b-0 hover:bg-[#FAFAFB]"
                >
                  <div className="font-bold text-secondary">#{sequenceNumberById.get(inquiry.id)}</div>
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
        onClick={closePanel}
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
                <div className="text-lg font-extrabold text-secondary">#{sequenceNumberById.get(selected.id)}</div>
              </div>
              <button
                onClick={closePanel}
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
              {isEditing ? (
                <>
                  <div>
                    <div className="mb-1.5 text-xs font-bold text-[#9A9AA2]">문의 유형</div>
                    <div className="flex flex-wrap gap-1.5">
                      {INQUIRY_CATEGORIES.map(({ value, label }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setEditCategory(value)}
                          className={`rounded-full border px-3.5 py-1.5 text-[12px] font-bold transition ${
                            editCategory === value
                              ? "border-primary bg-primary text-white"
                              : "border-[#DDDDE3] bg-white text-[#4B4B52] hover:border-primary hover:text-primary"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1.5 text-xs font-bold text-[#9A9AA2]">제목</div>
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      maxLength={200}
                      className="w-full rounded-[10px] border border-[#DDDDE3] px-3 py-2.5 text-[14px] outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <div className="mb-1.5 text-xs font-bold text-[#9A9AA2]">내용</div>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={6}
                      className="w-full resize-none rounded-[10px] border border-[#DDDDE3] px-3 py-2.5 text-[13.5px] outline-none focus:border-primary"
                    />
                  </div>
                </>
              ) : (
                <>
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
                </>
              )}
              {actionError && (
                <p className="m-0 rounded-[10px] bg-[#FFF1F1] px-3 py-2 text-[12.5px] font-semibold text-[#C21414]">
                  {actionError}
                </p>
              )}
              {selected.status === "UNHANDLED" && (
                <div className="flex gap-2">
                  {isEditing ? (
                    <>
                      <button
                        onClick={handleSaveEdit}
                        disabled={isSaving}
                        className="flex-1 rounded-[10px] border-2 border-primary-dark bg-primary py-2.5 text-[13px] font-bold text-white transition disabled:opacity-60"
                      >
                        {isSaving ? "저장 중..." : "저장"}
                      </button>
                      <button
                        onClick={cancelEdit}
                        disabled={isSaving}
                        className="flex-1 rounded-[10px] border border-[#DDDDE3] bg-white py-2.5 text-[13px] font-bold text-[#4B4B52]"
                      >
                        취소
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEdit(selected)}
                        className="flex-1 rounded-[10px] border border-[#DDDDE3] bg-white py-2.5 text-[13px] font-bold text-[#4B4B52] hover:border-primary hover:text-primary"
                      >
                        수정
                      </button>
                      <button
                        onClick={handleDeleteClick}
                        disabled={isSaving}
                        className={`flex-1 rounded-[10px] border py-2.5 text-[13px] font-bold transition disabled:opacity-60 ${
                          deleteConfirming
                            ? "border-primary-dark bg-primary text-white"
                            : "border-[#DDDDE3] bg-white text-[#4B4B52] hover:border-primary hover:text-primary"
                        }`}
                      >
                        {isSaving ? "삭제 중..." : deleteConfirming ? "정말 삭제하시겠습니까?" : "삭제"}
                      </button>
                    </>
                  )}
                </div>
              )}
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
                {selected.answerContent ? (
                  <p className="m-0 whitespace-pre-wrap rounded-[10px] bg-[#FAFAFB] px-3.5 py-3 text-[13.5px] leading-[1.6] text-[#2B2B31]">
                    {selected.answerContent}
                  </p>
                ) : (
                  <p className="m-0 rounded-[10px] bg-[#FAFAFB] px-3.5 py-3 text-[13.5px] text-[#9A9AA2]">
                    아직 답변이 등록되지 않았습니다.
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
