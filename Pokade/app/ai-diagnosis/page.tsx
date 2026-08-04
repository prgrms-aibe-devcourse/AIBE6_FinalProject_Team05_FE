"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GradeBadge from "@/components/GradeBadge";
import ConditionBar from "@/components/ConditionBar";
import PixelCharizard from "@/components/PixelCharizard";
import { apiPostFormRaw, ApiError, PageResponse } from "@/lib/apiClient";
import { fetchGradeHistory } from "@/lib/aiApi";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import type { GradeResponse } from "@/types/ai";

// 슬롯 순서는 백엔드 @RequestPart 이름과 그대로 매칭되어야 함 (front/back/corner_tl/tr/bl/br)
const SLOTS: { field: string; label: string }[] = [
  { field: "front", label: "앞면" },
  { field: "back", label: "뒷면" },
  { field: "corner_tl", label: "좌상단 모서리" },
  { field: "corner_tr", label: "우상단 모서리" },
  { field: "corner_bl", label: "좌하단 모서리" },
  { field: "corner_br", label: "우하단 모서리" },
];

const HISTORY_PAGE_SIZE = 10;

// 진단 흐름의 상태를 하나의 판별 유니언으로 관리 — 서로 동시에 있을 수 없는 값들을 분리된 state로 두면
// 항상 함께 세팅해야 하는 규칙이 컴파일러가 아닌 개발자 주의에만 의존하게 됨
type DiagnosisStatus =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "qualityFail"; retryOfId: number | null }
  | { kind: "success"; data: GradeResponse };

async function requestGrade(photos: File[], retryOfId: number | null): Promise<GradeResponse> {
  const formData = new FormData();
  SLOTS.forEach(({ field }, i) => formData.append(field, photos[i]));
  if (retryOfId != null) formData.append("retryOfId", String(retryOfId));

  try {
    return await apiPostFormRaw<GradeResponse>("/api/ai/grade", formData);
  } catch (e) {
    if (e instanceof ApiError) {
      console.error(`AI 진단 요청 실패 (HTTP ${e.status}):`, e.message);
      if (e.status === 503) {
        throw new Error(
          "AI 진단 서비스에 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
        );
      }
      if (e.status === 413) {
        throw new Error(
          "사진 용량이 너무 큽니다. 전체 합계 기준으로도 용량을 줄여 다시 올려주세요.",
        );
      }
      throw new Error("진단 요청에 실패했습니다.");
    }
    throw e;
  }
}

function UploadView({
  onSubmit,
  loading,
  error,
  isRetry,
}: {
  onSubmit: (photos: File[]) => void;
  loading: boolean;
  error: string | null;
  isRetry: boolean;
}) {
  const [photos, setPhotos] = useState<(File | null)[]>(Array(6).fill(null));
  const [previews, setPreviews] = useState<(string | null)[]>(Array(6).fill(null));
  const count = photos.filter(Boolean).length;
  const canStart = photos.every(Boolean) && !loading;

  // 언마운트 시(진단 성공 → ResultView 전환 등) 남아있는 blob URL을 전부 해제하기 위한 최신값 참조
  const previewsRef = useRef(previews);
  useEffect(() => {
    previewsRef.current = previews;
  }, [previews]);
  useEffect(() => {
    return () => {
      previewsRef.current.forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, []);

  const setAt = (i: number, file: File | null) => {
    setPhotos((prev) => {
      const next = [...prev];
      next[i] = file;
      return next;
    });
    setPreviews((prev) => {
      const next = [...prev];
      if (prev[i]) URL.revokeObjectURL(prev[i] as string);
      next[i] = file ? URL.createObjectURL(file) : null;
      return next;
    });
  };

  const onPick = (i: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setAt(i, file);
    e.target.value = "";
  };

  return (
    <div className="rounded-2xl border border-[#EDEDF0] bg-white p-[30px]">
      <h2 className="mb-1 mt-0 text-base font-extrabold">카드 사진 업로드</h2>
      <p className="mb-5 text-[13px] text-[#8A8A92]">
        앞면·뒷면·모서리 4곳을 촬영해 올려주세요 (6장 모두 필요)
      </p>
      {error && (
        <div className="mb-5 rounded-xl border border-[#F6C6C6] bg-[#FFF1F1] px-4 py-3.5 text-[13.5px] font-bold text-[#C21414]">
          {error}
        </div>
      )}
      {isRetry && !error && (
        <div className="mb-5 rounded-xl border border-[#F6C6C6] bg-[#FFF1F1] px-4 py-3.5 text-[13.5px] font-bold text-[#C21414]">
          카드를 인식하지 못했어요. 빛 반사가 적은 곳에서 다시 촬영해 주세요.
        </div>
      )}
      <div className="grid grid-cols-3 gap-3.5">
        {SLOTS.map(({ label }, i) =>
          previews[i] ? (
            <div
              key={i}
              className="relative aspect-[3/4] overflow-hidden rounded-[11px] bg-[#F2F2F5]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previews[i] as string}
                alt={`업로드 ${label}`}
                className="h-full w-full object-cover"
              />
              <button
                onClick={() => setAt(i, null)}
                aria-label="사진 삭제"
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/75"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <label
              key={i}
              className="flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-2 rounded-[11px] border-2 border-dashed border-[#D7D7DE] text-[#A8A8B0] transition hover:border-primary hover:text-primary"
            >
              <input type="file" accept="image/*" className="hidden" onChange={onPick(i)} />
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span className="text-xs font-semibold">{label}</span>
            </label>
          ),
        )}
      </div>
      <div className="mt-[22px] flex items-center justify-between border-t border-[#F0F0F0] pt-5">
        <div className="text-[13.5px] text-[#4B4B52]">
          업로드 <b className="text-primary">{count}</b> / 6장
        </div>
        <button
          disabled={!canStart}
          onClick={() => onSubmit(photos as File[])}
          className={`rounded-[11px] border-2 px-7 py-3 text-[15px] font-bold ${
            canStart
              ? "border-primary-dark bg-primary text-white shadow-tactile active:translate-y-0.5 active:shadow-tactile-active"
              : "cursor-not-allowed border-[#D6D6DC] bg-[#E4E4E8] text-[#A0A0A8]"
          }`}
        >
          {loading ? "진단 중..." : "진단 시작"}
        </button>
      </div>
    </div>
  );
}

function ResultView({
  result,
  onReset,
  resetLabel = "다시 진단하기",
}: {
  result: GradeResponse;
  onReset: () => void;
  resetLabel?: string;
}) {
  const scores: [string, number | null][] = [
    ["센터링", result.centeringScore],
    ["엣지", result.edgeScore],
    ["표면", result.surfaceScore],
    ["모서리", result.cornerScore],
  ];

  return (
    <div className="rounded-2xl border border-[#EDEDF0] bg-white p-[30px]">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-[#8A8A92]">종합 예상 등급</span>
        {result.grade && <GradeBadge grade={result.grade} size="lg" />}
      </div>
      <div className="mt-6 flex flex-col gap-[18px]">
        {scores.map(([label, score]) => (
          <div key={label}>
            <div className="mb-1.5 flex justify-between text-[13px]">
              <span className="font-bold text-[#4B4B52]">{label}</span>
              <span className="font-extrabold">{score != null ? score.toFixed(1) : "-"}</span>
            </div>
            <ConditionBar
              filled={score != null ? Math.round(score) : 0}
              size="lg"
              color="bg-secondary"
            />
          </div>
        ))}
      </div>
      {result.confidence != null && (
        <div className="mt-2 text-[12.5px] text-[#9A9AA2]">
          AI 신뢰도 {result.confidence.toFixed(1)}%
        </div>
      )}
      <div className="mt-[22px] rounded-[10px] bg-neutral px-[15px] py-3 text-[12.5px] leading-normal text-[#8A8A92]">
        {result.notice}
      </div>
      <div className="mt-2 text-[12px] text-[#B0B0B8]">
        {result.pointUsed > 0
          ? `포인트 ${result.pointUsed}점이 사용되었습니다.`
          : "무료로 처리되었습니다."}
      </div>
      <div className="mt-[18px] flex gap-3">
        <button
          onClick={onReset}
          className="flex-1 rounded-[11px] border-2 border-[#D6D6DC] bg-white py-3.5 text-[15.5px] font-bold text-[#4B4B52]"
        >
          {resetLabel}
        </button>
        <button
          disabled
          title="FR-AI-04에서 연동 예정"
          className="flex-1 cursor-not-allowed rounded-[11px] border-2 border-[#D6D6DC] bg-[#E4E4E8] py-3.5 text-[15.5px] font-bold text-[#A0A0A8]"
        >
          도감에 등록하기
        </button>
      </div>
    </div>
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function HistoryView() {
  const [page, setPage] = useState(0);
  const [data, setData] = useState<PageResponse<GradeResponse> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<GradeResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchGradeHistory(page, HISTORY_PAGE_SIZE)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setError(null);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof ApiError ? e.message : "이력을 불러오지 못했습니다.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  // 페이지 전환 시 로딩 표시는 여기(이벤트 핸들러)에서 미리 켠다 — effect 본문에서
  // setState를 동기 호출하면 리렌더가 겹치는 문제가 있어(react-hooks/set-state-in-effect) 피한다.
  const goToPage = (p: number) => {
    setLoading(true);
    setPage(p);
  };

  if (selected) {
    return (
      <ResultView
        result={selected}
        onReset={() => setSelected(null)}
        resetLabel="목록으로 돌아가기"
      />
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#EDEDF0] bg-white p-[50px] text-center text-[13.5px] text-[#8A8A92]">
        불러오는 중...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-[#F6C6C6] bg-[#FFF1F1] p-[30px] text-center text-[13.5px] font-bold text-[#C21414]">
        {error}
      </div>
    );
  }

  const items = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-[#EDEDF0] bg-white p-[50px] text-center">
        <PixelCharizard />
        <p className="mt-5 text-[14.5px] font-bold text-[#8A8A92]">이력이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#EDEDF0] bg-white p-[30px]">
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <button
            key={item.gradeResultId}
            onClick={() => setSelected(item)}
            className="flex items-center justify-between rounded-[11px] border border-[#EDEDF0] px-5 py-4 text-left transition hover:border-primary"
          >
            <div className="flex items-center gap-3">
              <GradeBadge grade={item.grade ?? undefined} />
              <div>
                <div className="text-[13.5px] font-bold text-[#4B4B52]">
                  {item.status === "SUCCESS" ? "진단 완료" : "품질 미달"}
                </div>
                <div className="text-[12px] text-[#9A9AA2]">{formatDateTime(item.createdAt)}</div>
              </div>
            </div>
            <span className="text-[12px] font-semibold text-[#9A9AA2]">
              {item.isFree ? "무료" : `포인트 ${item.pointUsed}`}
            </span>
          </button>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-1.5">
          <button
            onClick={() => goToPage(Math.max(0, page - 1))}
            disabled={page <= 0}
            aria-label="이전 페이지"
            className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-[#DDDDE3] bg-white text-[13px] font-bold text-[#4B4B52] enabled:hover:border-primary enabled:hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            &lt;
          </button>
          {Array.from({ length: totalPages }, (_, i) => i).map((p) => (
            <button
              key={p}
              onClick={() => goToPage(p)}
              aria-current={p === page ? "page" : undefined}
              className={`h-9 w-9 rounded-[9px] text-[13px] font-bold ${
                p === page
                  ? "bg-primary text-white"
                  : "border border-[#DDDDE3] bg-white text-[#4B4B52] hover:border-primary hover:text-primary"
              }`}
            >
              {p + 1}
            </button>
          ))}
          <button
            onClick={() => goToPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            aria-label="다음 페이지"
            className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-[#DDDDE3] bg-white text-[13px] font-bold text-[#4B4B52] enabled:hover:border-primary enabled:hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            &gt;
          </button>
        </div>
      )}
    </div>
  );
}

// useSearchParams는 정적 프리렌더 시 Suspense 경계를 요구함(next build에서 강제됨)
export default function AIDiagnosisPage() {
  return (
    <Suspense>
      <AIDiagnosisContent />
    </Suspense>
  );
}

function AIDiagnosisContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authStatus = useRequireAuth();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<DiagnosisStatus>({ kind: "idle" });
  // 새로고침해도 보던 탭(새 진단/이력)이 유지되도록 쿼리 파라미터(?tab=history)로 관리
  const [tab, setTabState] = useState<"new" | "history">(
    searchParams.get("tab") === "history" ? "history" : "new",
  );

  const setTab = (next: "new" | "history") => {
    setTabState(next);
    router.replace(next === "history" ? "/ai-diagnosis?tab=history" : "/ai-diagnosis", {
      scroll: false,
    });
  };

  const handleSubmit = async (photos: File[]) => {
    const retryOfId = status.kind === "qualityFail" ? status.retryOfId : null;
    setLoading(true);
    try {
      const response = await requestGrade(photos, retryOfId);
      if (response.status === "QUALITY_FAIL") {
        setStatus({
          kind: "qualityFail",
          retryOfId: response.retryAllowed ? response.gradeResultId : null,
        });
      } else {
        setStatus({ kind: "success", data: response });
      }
    } catch (e) {
      console.error("AI 진단 요청 중 오류:", e);
      setStatus({
        kind: "error",
        message: e instanceof Error ? e.message : "진단 요청에 실패했습니다.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => setStatus({ kind: "idle" });

  // 세션 복원 중이거나 비로그인(리다이렉트 예정)인 동안은 업로드 폼을 노출하지 않는다
  if (authStatus !== "authenticated") {
    return (
      <main className="main-content flex items-center justify-center bg-neutral px-10 py-14">
        <p className="text-sm text-[#8A8A92]">
          {authStatus === "loading" ? "세션 확인 중..." : "로그인 페이지로 이동 중..."}
        </p>
      </main>
    );
  }

  return (
    <main className="main-content bg-neutral px-10 pb-14 pt-9">
      <div className="mx-auto max-w-[1000px]">
        <div className="mb-5 text-center">
          <span className="inline-block rounded-md bg-[#FFF3CE] px-3 py-1.5 text-xs font-extrabold tracking-[1px] text-[#8A6A00]">
            AI GRADING
          </span>
          <h1 className="mt-3.5 text-[28px] font-extrabold tracking-[-0.6px]">AI 등급 진단</h1>
          <p className="mt-2 text-[14.5px] text-[#8A8A92]">
            카드 앞·뒷면 사진을 업로드하면 AI가 예상 등급을 분석합니다
          </p>
        </div>

        <div className="mb-5 flex justify-center gap-2">
          <button
            onClick={() => setTab("new")}
            className={`rounded-[10px] px-5 py-2.5 text-[13.5px] font-bold transition ${
              tab === "new"
                ? "bg-primary text-white"
                : "border border-[#DDDDE3] bg-white text-[#4B4B52] hover:border-primary hover:text-primary"
            }`}
          >
            새 진단 요청
          </button>
          <button
            onClick={() => setTab("history")}
            className={`rounded-[10px] px-5 py-2.5 text-[13.5px] font-bold transition ${
              tab === "history"
                ? "bg-primary text-white"
                : "border border-[#DDDDE3] bg-white text-[#4B4B52] hover:border-primary hover:text-primary"
            }`}
          >
            진단 이력
          </button>
        </div>

        {tab === "history" ? (
          <HistoryView />
        ) : status.kind === "success" ? (
          <ResultView result={status.data} onReset={handleReset} />
        ) : (
          <UploadView
            onSubmit={handleSubmit}
            loading={loading}
            error={status.kind === "error" ? status.message : null}
            isRetry={status.kind === "qualityFail"}
          />
        )}
      </div>
    </main>
  );
}
