"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import CardImage from "@/components/CardImage";
import GradeBadge from "@/components/GradeBadge";
import type { Grade } from "@/components/GradeBadge";
import ConditionBar from "@/components/ConditionBar";
import PixelCharizard from "@/components/PixelCharizard";
import { apiPostFormRaw, ApiError, PageResponse } from "@/lib/apiClient";
import { fetchGradeHistory } from "@/lib/aiApi";
import { ensureUploadableImage } from "@/lib/heicConvert";
import { addPortfolioItemFromGrade } from "@/lib/portfolioApi";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useUserStore } from "@/store/useUserStore";
import type { GradeResponse } from "@/types/ai";

const FREE_DIAGNOSES = 3;
const DIAGNOSIS_COST = 100;

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

// 테스트 계정이 직접 사진을 찍지 않고도 진단을 시연해볼 수 있도록 public에 미리 넣어둔 데모 이미지
const DEMO_PHOTO_URLS: Record<string, string> = {
  front: "/demo/ai-diagnosis/front.png",
  back: "/demo/ai-diagnosis/back.png",
  corner_tl: "/demo/ai-diagnosis/corner_tl.png",
  corner_tr: "/demo/ai-diagnosis/corner_tr.png",
  corner_bl: "/demo/ai-diagnosis/corner_bl.png",
  corner_br: "/demo/ai-diagnosis/corner_br.png",
};

async function loadDemoPhotos(): Promise<File[]> {
  return Promise.all(
    SLOTS.map(async ({ field }) => {
      const res = await fetch(DEMO_PHOTO_URLS[field]);
      if (!res.ok) throw new Error(`데모 이미지를 불러오지 못했습니다: ${field}`);
      const blob = await res.blob();
      return new File([blob], `${field}.png`, { type: blob.type || "image/png" });
    }),
  );
}

// 슬롯별로 어떻게 찍어야 하는지 — 데모 사진을 예시로 보여주는 촬영 가이드 섹션에서 사용
const GUIDE_TIPS: Record<string, string> = {
  front: "카드 전체가 프레임 안에 들어오도록 반듯하게 촬영해주세요.",
  back: "뒷면도 앞면과 같은 각도로, 빛 반사 없이 촬영해주세요.",
  corner_tl: "모서리를 가까이 확대해 마모·꺾임이 잘 보이게 찍어주세요.",
  corner_tr: "모서리를 가까이 확대해 마모·꺾임이 잘 보이게 찍어주세요.",
  corner_bl: "모서리를 가까이 확대해 마모·꺾임이 잘 보이게 찍어주세요.",
  corner_br: "모서리를 가까이 확대해 마모·꺾임이 잘 보이게 찍어주세요.",
};

function ShootingGuide() {
  return (
    <div className="mt-5 rounded-2xl border border-[#EDEDF0] bg-white p-5 sm:p-[30px]">
      <span className="inline-block rounded-md bg-[#FFF3CE] px-3 py-1.5 text-xs font-extrabold tracking-[1px] text-[#8A6A00]">
        촬영 가이드
      </span>
      <h2 className="mb-1 mt-3 text-base font-extrabold">이렇게 6장을 찍어주세요</h2>
      <p className="mb-5 text-[13px] text-[#8A8A92]">
        아래 예시처럼 앞·뒷면 전체 사진과 네 모서리 확대 사진을 준비하면 AI가 더 정확하게 분석합니다.
      </p>
      <div className="flex flex-col gap-3.5">
        {SLOTS.map(({ field, label }) => (
          <div
            key={field}
            className="flex flex-col items-center gap-3 rounded-[11px] border border-[#EDEDF0] p-4 sm:flex-row sm:items-center sm:gap-5"
          >
            <div className="relative aspect-[3/4] w-[140px] flex-shrink-0 overflow-hidden rounded-[9px] bg-[#F2F2F5] sm:w-[200px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={DEMO_PHOTO_URLS[field]}
                alt={`${label} 촬영 예시`}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="text-center sm:text-left">
              <div className="text-[15px] font-bold">{label}</div>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#8A8A92]">
                {GUIDE_TIPS[field]}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 등급별 기준 설명 — BE(AiGradeService의 Vision 프롬프트)가 안내하는 PSA 상당 등급 기준과 동일한 문구.
const GRADE_DESCRIPTIONS: Record<Grade, string> = {
  S: "PSA 9~10 상당 — 민트 상태. 결함 없이 날카로운 모서리와 깨끗한 엣지, 중앙 정렬.",
  A: "PSA 7~8 상당 — 엑셀런트~니어민트. 경미한 결함이나 약간의 모서리·엣지 마모 허용.",
  B: "PSA 5~6 상당 — 굿~엑셀런트. 눈에 띄는 결함이 있으나 감상에는 무리 없는 수준.",
};

// 세부 점수 4항목이 각각 무엇을 보는지 — ResultView의 점수 라벨과 그대로 매칭되어야 함
const SCORE_INFO: { label: string; desc: string }[] = [
  { label: "센터링", desc: "카드 프레임 안에서 그림·테두리가 정중앙에 위치했는지" },
  { label: "엣지", desc: "가장자리의 닳음, 화이트닝(테두리 흰 선) 정도" },
  { label: "표면", desc: "스크래치, 눌림 자국 등 표면 손상 정도" },
  { label: "모서리", desc: "네 모서리의 마모·꺾임 정도" },
];

function GradeInfo() {
  return (
    <div className="mb-5 rounded-2xl border border-[#EDEDF0] bg-white p-5 sm:p-[30px]">
      <span className="inline-block rounded-md bg-[#FFF3CE] px-3 py-1.5 text-xs font-extrabold tracking-[1px] text-[#8A6A00]">
        등급 안내
      </span>
      <h2 className="mb-1 mt-3 text-base font-extrabold">등급과 신뢰도, 이렇게 봐주세요</h2>
      <p className="mb-5 text-[13px] leading-relaxed text-[#8A8A92]">
        PSA 등급을 받기엔 애매하거나, 정식 감정 비용이 부담스러운 카드도 괜찮습니다. AI 진단은 낮은
        등급의 카드도 부담 없이 가볍게 측정해볼 수 있도록 만들어졌습니다.
      </p>

      <div className="mb-6 flex flex-col gap-3">
        {(["S", "A", "B"] as Grade[]).map((g) => (
          <div
            key={g}
            className="flex items-center gap-3.5 rounded-[11px] border border-[#EDEDF0] p-3.5"
          >
            <GradeBadge grade={g} size="lg" />
            <p className="text-[13px] text-[#4B4B52]">{GRADE_DESCRIPTIONS[g]}</p>
          </div>
        ))}
      </div>

      <h3 className="mb-2.5 text-[13.5px] font-bold">세부 점수 항목</h3>
      <div className="mb-6 grid grid-cols-2 gap-3">
        {SCORE_INFO.map(({ label, desc }) => (
          <div key={label} className="rounded-[11px] border border-[#EDEDF0] p-3.5">
            <div className="text-[12.5px] font-bold text-[#4B4B52]">{label}</div>
            <p className="mt-1 text-[12px] leading-relaxed text-[#8A8A92]">{desc}</p>
          </div>
        ))}
      </div>

      <div className="rounded-[10px] bg-neutral px-4 py-3.5 text-[12.5px] leading-relaxed text-[#8A8A92]">
        <b className="text-[#4B4B52]">AI 신뢰도란?</b> AI가 업로드된 사진에서 카드 상태를 얼마나
        명확하게 인식했는지 나타내는 지표입니다. 빛 반사, 초점 흐림, 각도 문제로 사진이 불명확하면
        신뢰도가 낮게 나올 수 있으며, 이 경우 결과의 정확도도 함께 낮아질 수 있습니다. 신뢰도가
        낮다면 촬영 가이드를 참고해 다시 촬영해보시는 걸 권장합니다.
      </div>
    </div>
  );
}

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
      if (e.code === "REQUEST_TIMEOUT") {
        throw new Error(
          "AI 분석이 예상보다 오래 걸려 요청을 중단했습니다. 잠시 후 다시 시도해 주세요.",
        );
      }
      // 형식 오류 등 400대는 BE가 이미 "어떤 파일이 왜 문제인지" 사용자용 문구로 내려주므로
      // 그대로 보여준다 — 뭉뚱그린 메시지로 덮으면 6장 중 무엇이 문제인지 알 길이 없어진다.
      throw new Error(e.message || "진단 요청에 실패했습니다.");
    }
    throw e;
  }
}

function UploadView({
  onSubmit,
  loading,
  error,
  isRetry,
  diagnosisCount,
}: {
  onSubmit: (photos: File[]) => void;
  loading: boolean;
  error: string | null;
  isRetry: boolean;
  diagnosisCount: number | null;
}) {
  const [photos, setPhotos] = useState<(File | null)[]>(Array(6).fill(null));
  const [previews, setPreviews] = useState<(string | null)[]>(Array(6).fill(null));
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [demoNotice, setDemoNotice] = useState<string | null>(null);
  const count = photos.filter(Boolean).length;
  const canStart = photos.every(Boolean) && !loading;
  const pointBalance = useUserStore((s) => s.pointBalance);

  // BE 에러 메시지가 "...: 파일명" 형태로 끝나면(형식 오류) 어느 슬롯이 문제인지 파일명으로 역추적한다.
  const badSlotIndex = error ? photos.findIndex((p) => p && error.endsWith(p.name)) : -1;

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
    setDemoNotice(null);
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

  // HEIC 변환이 비동기라, 변환 중에 같은 슬롯을 다시 선택하면 먼저 시작한 느린 변환이
  // 나중에 끝나 최신 선택을 덮어쓸 수 있다 — 슬롯별 요청 번호로 최신 요청만 반영한다.
  const pickRequestIdRef = useRef<number[]>(Array(6).fill(0));

  const onPick = (i: number) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const requestId = ++pickRequestIdRef.current[i];
    const uploadable = await ensureUploadableImage(file);
    if (pickRequestIdRef.current[i] !== requestId) return; // 그 사이 같은 슬롯이 다시 선택됨
    setAt(i, uploadable);
  };

  const onLoadDemo = async () => {
    // 이미 채워둔(직접 찍었거나 이전 데모로 채운) 사진이 있으면 그냥 덮어써서 조용히 실패하는 대신
    // 먼저 지워달라고 안내한다.
    if (count > 0) {
      setDemoNotice("이미 카드 사진이 채워져 있어요. 사진을 모두 지운 뒤 다시 눌러주세요.");
      return;
    }
    setDemoLoading(true);
    setDemoError(null);
    setDemoNotice(null);
    // 로컬 이미지라 순식간에 끝나 "불러오는 중" 문구가 한 프레임만 반짝이고 사라져 보인다 —
    // 최소 노출 시간을 둬 로딩 상태가 실제로 인지되도록 한다.
    const minDuration = new Promise((resolve) => setTimeout(resolve, 400));
    try {
      const [files] = await Promise.all([loadDemoPhotos(), minDuration]);
      files.forEach((file, i) => setAt(i, file));
    } catch (e) {
      setDemoError(e instanceof Error ? e.message : "데모 사진을 불러오지 못했습니다.");
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#EDEDF0] bg-white p-5 sm:p-[30px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="mb-1 mt-0 text-base font-extrabold">카드 사진 업로드</h2>
          <p className="mb-1 text-[13px] text-[#8A8A92]">
            앞면·뒷면·모서리 4곳을 촬영해 올려주세요 (6장 모두 필요)
          </p>
          <p className="mb-3 text-[12px] text-[#B4B4BC]">
            아이폰에서 촬영한 사진(HEIC)은 업로드 시 자동 변환되며, 이 과정에서 약간의 화질
            손상이 있을 수 있습니다.
          </p>
        </div>
        <button
          onClick={onLoadDemo}
          disabled={demoLoading || loading}
          className="shrink-0 whitespace-nowrap rounded-[9px] border border-[#DDDDE3] bg-white px-3.5 py-2 text-[12.5px] font-bold text-[#4B4B52] transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {demoLoading ? "불러오는 중..." : "테스트 해보기"}
        </button>
      </div>
      <div className="mb-5 flex flex-col gap-4 rounded-[12px] border border-[#EDEDF0] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="text-[13px] text-[#4B4B52]">
            처음 {FREE_DIAGNOSES}회 무료 · 이후 <b>{DIAGNOSIS_COST.toLocaleString("ko-KR")}P / 회</b>
          </div>
          {diagnosisCount !== null && (
            diagnosisCount < FREE_DIAGNOSES ? (
              <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[#E8F5EE] px-2.5 py-1 text-[12px] font-bold text-[#1A8A4A]">
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <circle cx="6" cy="6" r="5.5" stroke="#1A8A4A" />
                  <path d="M3.5 6L5.5 8L8.5 4" stroke="#1A8A4A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                무료 {FREE_DIAGNOSES - diagnosisCount}회 남음
              </span>
            ) : (
              <span className="inline-flex w-fit rounded-full bg-[#F5F5F7] px-2.5 py-1 text-[12px] font-bold text-[#8A8A92]">
                무료 소진
              </span>
            )
          )}
        </div>
        {pointBalance !== null && (
          <div className="flex shrink-0 items-center gap-2.5 rounded-[10px] bg-[#FFFBE8] px-4 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F5C518] text-[12px] font-extrabold text-white shadow-sm">
              P
            </div>
            <div>
              <div className="text-[10.5px] font-semibold text-[#9A8000]">보유 포인트</div>
              <div className="text-[16px] font-extrabold leading-tight text-[#4A3800]">
                {pointBalance.toLocaleString("ko-KR")}
              </div>
            </div>
          </div>
        )}
      </div>
      {demoNotice && (
        <div className="mb-5 rounded-xl border border-[#DDDDE3] bg-neutral px-4 py-3.5 text-[13.5px] font-bold text-[#4B4B52]">
          {demoNotice}
        </div>
      )}
      {demoError && (
        <div className="mb-5 rounded-xl border border-[#F6C6C6] bg-[#FFF1F1] px-4 py-3.5 text-[13.5px] font-bold text-[#C21414]">
          {demoError}
        </div>
      )}
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
              className={`relative aspect-[3/4] animate-fade-in overflow-hidden rounded-[11px] bg-[#F2F2F5] ${
                badSlotIndex === i ? "ring-2 ring-[#E53E3E]" : ""
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previews[i] as string}
                alt={`업로드 ${label}`}
                className="h-full w-full object-contain"
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

// 도감 등록(FR-AI-04) 진행 상태 — 판별 유니언으로 관리해 "등록 중이면서 이미 등록됨" 같은
// 불가능한 조합이 애초에 만들어지지 않게 한다.
type RegisterStatus =
  | { kind: "idle" }
  | { kind: "registering" }
  | { kind: "registered" }
  | { kind: "error"; message: string };

function ResultView({
  result,
  onReset,
  resetLabel = "다시 진단하기",
}: {
  result: GradeResponse;
  onReset: () => void;
  resetLabel?: string;
}) {
  const [registerStatus, setRegisterStatus] = useState<RegisterStatus>({ kind: "idle" });

  const scores: [string, number | null][] = [
    ["센터링", result.centeringScore],
    ["엣지", result.edgeScore],
    ["표면", result.surfaceScore],
    ["모서리", result.cornerScore],
  ];

  // 정상 산출(SUCCESS) + 카드 인식(cardId) 둘 다 있어야 도감에 등록할 수 있다.
  const canRegister = result.status === "SUCCESS" && result.cardId != null;

  const handleRegister = async () => {
    setRegisterStatus({ kind: "registering" });
    try {
      await addPortfolioItemFromGrade(result.gradeResultId);
      setRegisterStatus({ kind: "registered" });
    } catch (e) {
      // 이미 등록된 결과(409)를 재조회해서 다시 눌렀을 때도 에러가 아니라 "등록됨"으로 보여준다.
      if (e instanceof ApiError && e.code === "GRADE_RESULT_ALREADY_REGISTERED") {
        setRegisterStatus({ kind: "registered" });
        return;
      }
      setRegisterStatus({
        kind: "error",
        message: e instanceof ApiError ? e.message : "도감 등록에 실패했습니다.",
      });
    }
  };

  return (
    <div className="rounded-2xl border border-[#EDEDF0] bg-white p-5 sm:p-[30px]">
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
      {result.status === "SUCCESS" && (
        <div className="mt-[18px] flex items-center gap-3 rounded-[11px] border border-[#EDEDF0] px-4 py-3">
          {result.cardId != null ? (
            <>
              <div className="relative h-14 w-10 flex-shrink-0 overflow-hidden rounded-[7px] bg-[#F2F2F5]">
                <CardImage src={result.cardImageSmall ?? undefined} alt={result.cardName ?? "카드"} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold text-[#8A8A92]">인식된 카드</div>
                <div className="truncate text-[14px] font-bold">{result.cardName}</div>
              </div>
              {result.cardConfidence != null && (
                <div className="flex-shrink-0 text-[12px] font-semibold text-[#9A9AA2]">
                  인식 신뢰도 {result.cardConfidence.toFixed(0)}%
                </div>
              )}
            </>
          ) : (
            <div className="text-[13px] font-semibold text-[#8A8A92]">
              카드를 인식하지 못해 도감에 바로 등록할 수 없어요. 도감 화면에서 직접 추가해 주세요.
            </div>
          )}
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
      {registerStatus.kind === "error" && (
        <div
          role="alert"
          className="mt-[14px] rounded-[10px] border border-[#F6C6C6] bg-[#FFF1F1] px-4 py-3 text-[13px] font-semibold text-[#C21414]"
        >
          {registerStatus.message}
        </div>
      )}
      {registerStatus.kind === "registered" && (
        <div className="mt-[14px] rounded-[10px] border border-[#CDEAD9] bg-[#EEFBF3] px-4 py-3 text-[13px] font-semibold text-[#0F7A46]">
          도감에 등록했어요.{" "}
          <Link href="/portfolio" className="underline">
            도감 보러가기
          </Link>
        </div>
      )}
      <div className="mt-[18px] flex gap-3">
        <button
          onClick={onReset}
          className="flex-1 rounded-[11px] border-2 border-[#D6D6DC] bg-white py-3.5 text-[15.5px] font-bold text-[#4B4B52]"
        >
          {resetLabel}
        </button>
        <button
          disabled={!canRegister || registerStatus.kind === "registering" || registerStatus.kind === "registered"}
          title={!canRegister ? "카드를 인식하지 못해 등록할 수 없어요" : undefined}
          onClick={handleRegister}
          className={`flex-1 rounded-[11px] border-2 py-3.5 text-[15.5px] font-bold ${
            canRegister && registerStatus.kind !== "registered"
              ? "border-primary-dark bg-primary text-white shadow-tactile-sm active:translate-y-0.5 disabled:cursor-wait disabled:opacity-70"
              : "cursor-not-allowed border-[#D6D6DC] bg-[#E4E4E8] text-[#A0A0A8]"
          }`}
        >
          {registerStatus.kind === "registering"
            ? "등록 중..."
            : registerStatus.kind === "registered"
              ? "등록 완료"
              : "도감에 등록하기"}
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
        key={selected.gradeResultId}
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
      <div className="rounded-2xl border border-[#F6C6C6] bg-[#FFF1F1] p-5 sm:p-[30px] text-center text-[13.5px] font-bold text-[#C21414]">
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
    <div className="rounded-2xl border border-[#EDEDF0] bg-white p-5 sm:p-[30px]">
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
  const decrementPointBalance = useUserStore((s) => s.decrementPointBalance);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<DiagnosisStatus>({ kind: "idle" });
  const [diagnosisCount, setDiagnosisCount] = useState<number | null>(null);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    let cancelled = false;
    fetchGradeHistory(0, 1)
      .then((r) => { if (!cancelled) setDiagnosisCount(r.totalElements); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [authStatus]);
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
        setDiagnosisCount((c) => (c !== null ? c + 1 : null));
        if (response.pointUsed > 0) decrementPointBalance(response.pointUsed);
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
    <main className="main-content bg-neutral px-4 pb-14 pt-9 sm:px-10">
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
          <>
            <GradeInfo />
            <UploadView
              onSubmit={handleSubmit}
              loading={loading}
              error={status.kind === "error" ? status.message : null}
              isRetry={status.kind === "qualityFail"}
              diagnosisCount={diagnosisCount}
            />
            <ShootingGuide />
          </>
        )}
      </div>
    </main>
  );
}
