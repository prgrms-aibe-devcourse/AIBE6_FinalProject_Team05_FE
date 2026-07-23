"use client";

import { useState } from "react";
import GradeBadge from "@/components/GradeBadge";
import ConditionBar from "@/components/ConditionBar";
import CardImage from "@/components/CardImage";

type View = "upload" | "fail" | "exhausted" | "result";
const VIEWS: [View, string][] = [
  ["upload", "업로드"],
  ["fail", "인식 실패"],
  ["exhausted", "무료 소진"],
  ["result", "진단 결과"],
];

// 6칸: 앞면 + 뒷면 + 모서리 4곳(전부 "추가"로 통일)
const SLOT_LABELS = ["앞면", "뒷면", "추가", "추가", "추가", "추가"];

function UploadView() {
  const [photos, setPhotos] = useState<(string | null)[]>(Array(6).fill(null));
  const count = photos.filter(Boolean).length;
  const canStart = Boolean(photos[0] && photos[1]); // 앞면+뒷면 최소 2장

  const setAt = (i: number, url: string | null) => {
    setPhotos((prev) => {
      const next = [...prev];
      if (prev[i]) URL.revokeObjectURL(prev[i] as string);
      next[i] = url;
      return next;
    });
  };

  const onPick = (i: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setAt(i, URL.createObjectURL(file));
    e.target.value = ""; // 같은 파일 재선택 허용
  };

  return (
    <div className="rounded-2xl border border-[#EDEDF0] bg-white p-[30px]">
      <h2 className="mb-1 mt-0 text-base font-extrabold">카드 사진 업로드</h2>
      <p className="mb-5 text-[13px] text-[#8A8A92]">
        앞면·뒷면·모서리 4곳을 촬영해 올려주세요 (최대 6장)
      </p>
      <div className="grid grid-cols-3 gap-3.5">
        {photos.map((url, i) =>
          url ? (
            <div
              key={i}
              className="relative aspect-[3/4] overflow-hidden rounded-[11px] bg-[#F2F2F5]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`업로드 ${i + 1}`} className="h-full w-full object-cover" />
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
              <span className="text-xs font-semibold">{SLOT_LABELS[i]}</span>
            </label>
          ),
        )}
      </div>
      <div className="mt-[22px] flex items-center justify-between border-t border-[#F0F0F0] pt-5">
        <div className="text-[13.5px] text-[#4B4B52]">
          업로드 <b className="text-primary">{count}</b> / 6장
          <span className="ml-2 text-xs text-[#9A9AA2]">· 오늘 무료 진단 2/3회 남음</span>
        </div>
        <button
          disabled={!canStart}
          className={`rounded-[11px] border-2 px-7 py-3 text-[15px] font-bold ${
            canStart
              ? "border-primary-dark bg-primary text-white shadow-tactile active:translate-y-0.5 active:shadow-tactile-active"
              : "cursor-not-allowed border-[#D6D6DC] bg-[#E4E4E8] text-[#A0A0A8]"
          }`}
        >
          진단 시작
        </button>
      </div>
    </div>
  );
}

export default function AIDiagnosisPage() {
  const [view, setView] = useState<View>("upload");
  const chip = (a: boolean) =>
    `rounded-[9px] border-[1.5px] px-[15px] py-2 text-[13px] cursor-pointer ${a ? "border-primary bg-[#FFF5F5] font-bold text-primary" : "border-[#E4E4E9] bg-white font-semibold text-[#7A7A82]"}`;

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

        <div className="mb-6 flex justify-center gap-2">
          {VIEWS.map(([k, l]) => (
            <button key={k} className={chip(view === k)} onClick={() => setView(k)}>
              {l}
            </button>
          ))}
        </div>

        {view === "upload" && <UploadView />}

        {view === "fail" && (
          <div className="rounded-2xl border border-[#EDEDF0] bg-white p-[30px]">
            <div className="mb-[22px] flex items-center gap-[11px] rounded-xl border border-[#F6C6C6] bg-[#FFF1F1] px-4 py-3.5">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#EE1515"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              <span className="text-[13.5px] font-bold text-[#C21414]">
                카드를 인식하지 못했어요. 빛 반사가 적은 곳에서 다시 촬영해 주세요.
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3.5">
              <div className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-[11px] border-2 border-primary bg-[#FFF6F6] text-primary">
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
                <span className="text-xs font-bold">인식 실패</span>
              </div>
              <div className="aspect-[3/4] overflow-hidden rounded-[11px] bg-[#F2F2F5]">
                <CardImage label="뒷면" />
              </div>
              <div className="flex aspect-[3/4] items-center justify-center rounded-[11px] border-2 border-dashed border-[#D7D7DE] text-[#A8A8B0]">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </div>
            </div>
            <div className="mt-[22px] flex justify-center">
              <button
                onClick={() => setView("upload")}
                className="rounded-[11px] border-2 border-primary-dark bg-primary px-[30px] py-3 text-[15px] font-bold text-white shadow-tactile active:translate-y-0.5 active:shadow-tactile-active"
              >
                다시 업로드
              </button>
            </div>
          </div>
        )}

        {view === "exhausted" && (
          <div className="rounded-2xl border border-[#EDEDF0] bg-white p-[30px]">
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#F5E4A8] bg-[#FFF9E6] px-5 py-[18px]">
              <svg
                className="mt-px flex-shrink-0"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#B8860B"
                strokeWidth="2"
              >
                <path d="M12 2l2.5 6.5L21 9l-5 4 1.5 7L12 16l-5.5 4L8 13 3 9l6.5-.5z" />
              </svg>
              <div>
                <div className="text-[15px] font-extrabold text-[#8A6A00]">
                  오늘의 무료 진단을 모두 사용했어요
                </div>
                <p className="mt-[5px] text-[13.5px] leading-[1.55] text-[#9A7A20]">
                  포인트로 추가 진단을 이용하거나, 내일 다시 무료 진단을 받을 수 있어요.
                </p>
              </div>
            </div>
            <label className="mb-2 block text-[13px] font-bold text-[#4B4B52]">
              진단 포인트 충전
            </label>
            <div className="flex items-center gap-3">
              <select className="flex-1 cursor-pointer rounded-[11px] border border-[#DDDDE3] bg-white px-3.5 py-3 text-[14.5px] outline-none">
                <option>진단권 3회 — ₩2,900</option>
                <option>진단권 10회 — ₩8,900</option>
                <option>진단권 30회 — ₩19,900</option>
              </select>
              <button className="whitespace-nowrap rounded-[11px] border-2 border-primary-dark bg-primary px-[26px] py-3 text-[15px] font-bold text-white shadow-tactile active:translate-y-0.5 active:shadow-tactile-active">
                충전하기
              </button>
            </div>
          </div>
        )}

        {view === "result" && (
          <div className="grid grid-cols-[300px_1fr] gap-8 rounded-2xl border border-[#EDEDF0] bg-white p-[30px]">
            <div>
              <div className="relative aspect-[3/4] overflow-hidden rounded-[13px] bg-[#F2F2F5]">
                <CardImage label="진단 카드" />
                <GradeBadge grade="S" size="lg" className="absolute left-2.5 top-2.5" />
              </div>
              <div className="mt-4 text-center">
                <div className="text-base font-extrabold">리자몽 ex</div>
                <div className="mt-0.5 text-[12.5px] text-[#9A9AA2]">흑염의 지배자 · SAR</div>
              </div>
            </div>
            <div>
              <span className="text-sm font-semibold text-[#8A8A92]">종합 예상 등급</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-[40px] font-extrabold tracking-[-1px]">9.2</span>
                <span className="text-lg font-bold text-[#9A9AA2]">/ 10</span>
              </div>
              <div className="mt-6 flex flex-col gap-[18px]">
                {[
                  ["모서리", "9.4", 9],
                  ["중앙정렬", "9.0", 8],
                  ["표면 스크래치", "9.1", 9],
                ].map(([l, v, f]) => (
                  <div key={l as string}>
                    <div className="mb-1.5 flex justify-between text-[13px]">
                      <span className="font-bold text-[#4B4B52]">{l}</span>
                      <span className="font-extrabold">{v}</span>
                    </div>
                    <ConditionBar filled={f as number} size="lg" color="bg-secondary" />
                  </div>
                ))}
              </div>
              <div className="mt-[22px] rounded-[10px] bg-neutral px-[15px] py-3 text-[12.5px] leading-normal text-[#8A8A92]">
                본 AI 진단은 참고용 예상 등급이며,{" "}
                <b className="text-[#4B4B52]">PSA 정식 감정을 대체하지 않습니다.</b>
              </div>
              <button className="mt-[18px] w-full rounded-[11px] border-2 border-primary-dark bg-primary py-3.5 text-[15.5px] font-bold text-white shadow-tactile active:translate-y-0.5 active:shadow-tactile-active">
                도감에 등록하기
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
