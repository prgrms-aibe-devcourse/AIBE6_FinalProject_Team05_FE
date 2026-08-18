"use client";

import { useEffect, useState } from "react";
import AdminSidebar from "@/components/AdminSidebar";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { fetchListingReports, hideListing } from "@/lib/adminApi";
import { ApiError } from "@/lib/apiClient";
import { ReportResponse, ReportStatus } from "@/types/adminReport";

type LoadState = "loading" | "ready" | "error";

const STATUS_STYLES: Record<ReportStatus, string> = {
  PENDING: "bg-[#FFF3CE] text-[#8A6A00]",
  REVIEWED: "bg-lavender text-secondary",
  ACCEPTED: "bg-[#E8F7EF] text-[#059669]",
  DISMISSED: "bg-[#EEF0F2] text-[#9A9AA2]",
};

const STATUS_LABELS: Record<ReportStatus, string> = {
  PENDING: "대기중",
  REVIEWED: "검토됨",
  ACCEPTED: "인정",
  DISMISSED: "기각",
};

// "yyyy-MM-ddTHH:mm:ss" → "YYYY.MM.DD HH:mm" (다른 화면들과 동일한 표시 규칙).
function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminListingReportsPage() {
  useRequireAuth();
  const [reports, setReports] = useState<ReportResponse[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  // 처리(숨김) 진행 중인 신고 targetId, 처리 완료된 targetId 집합, 항목별 에러 메시지.
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    let cancelled = false;
    fetchListingReports()
      .then((data) => {
        if (cancelled) return;
        setReports(data);
        setLoadState("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMessage(err instanceof ApiError ? err.message : "신고 목록을 불러오지 못했습니다.");
        setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleHide = async (targetId: number) => {
    setProcessingId(targetId);
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[targetId];
      return next;
    });
    try {
      await hideListing(targetId);
      setHiddenIds((prev) => new Set(prev).add(targetId));
    } catch (err) {
      setRowErrors((prev) => ({
        ...prev,
        [targetId]: err instanceof ApiError ? err.message : "숨김 처리에 실패했습니다.",
      }));
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <main className="main-content flex bg-neutral">
      <AdminSidebar />

      <div className="min-w-0 flex-1 px-9 py-8">
        <h1 className="mb-1 mt-0 text-2xl font-extrabold tracking-[-0.5px]">매물 신고 관리</h1>
        <p className="mb-[22px] text-[13.5px] text-[#8A8A92]">
          접수된 매물 신고를 검토하고 숨김 처리합니다
        </p>

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

        {loadState === "ready" && reports.length === 0 && (
          <div className="rounded-[14px] border border-[#EDEDF0] bg-white px-6 py-14 text-center text-[13.5px] text-[#8A8A92]">
            접수된 매물 신고가 없습니다.
          </div>
        )}

        {loadState === "ready" && reports.length > 0 && (
          <div className="overflow-hidden rounded-[14px] border border-[#EDEDF0] bg-white">
            <div className="grid grid-cols-[0.8fr_0.8fr_1.6fr_0.9fr_1fr_1fr_1fr] gap-3.5 border-b border-[#EDEDF0] bg-[#FAFAFB] px-[22px] py-[13px] text-xs font-bold text-[#9A9AA2]">
              <div>신고번호</div>
              <div>매물 ID</div>
              <div>사유</div>
              <div>신고자</div>
              <div>접수</div>
              <div>상태</div>
              <div>처리</div>
            </div>
            {reports.map((r) => {
              const hidden = hiddenIds.has(r.targetId);
              const rowError = rowErrors[r.targetId];
              return (
                <div
                  key={r.id}
                  className="grid grid-cols-[0.8fr_0.8fr_1.6fr_0.9fr_1fr_1fr_1fr] items-center gap-3.5 border-b border-[#F2F2F5] px-[22px] py-[15px] text-[13.5px] last:border-b-0"
                >
                  <div className="font-bold text-secondary">#{r.id}</div>
                  <div>#{r.targetId}</div>
                  <div className="truncate text-[#4B4B52]">{r.reason ?? "-"}</div>
                  <div className="text-[#5A5A62]">#{r.reporterId}</div>
                  <div className="text-[#9A9AA2]">{formatDateTime(r.createdAt)}</div>
                  <div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11.5px] font-bold ${STATUS_STYLES[r.status]}`}
                    >
                      {STATUS_LABELS[r.status]}
                    </span>
                  </div>
                  <div>
                    {hidden ? (
                      <span className="text-[12.5px] font-semibold text-[#9A9AA2]">
                        숨김 완료
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={processingId === r.targetId}
                        onClick={() => handleHide(r.targetId)}
                        className="rounded-[9px] border-[1.5px] border-primary-dark bg-primary px-3 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-60"
                      >
                        {processingId === r.targetId ? "처리 중..." : "숨김 처리"}
                      </button>
                    )}
                    {rowError && (
                      <div className="mt-1 text-[11.5px] font-semibold text-[#C21414]">
                        {rowError}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
