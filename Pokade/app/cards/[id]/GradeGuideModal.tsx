"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useEscapeAndScrollLock } from "@/hooks/useEscapeAndScrollLock";

type GuideTab = "ours" | "psa";

// app/ai-diagnosis/page.tsx의 GRADE_DESCRIPTIONS와 동일한 문구(자체 AI등급 S/A/B) — 판매/구매입찰
// 등록 전 안내이므로 별도 파일이지만 내용은 그대로 재사용한다.
const OUR_GRADE_GUIDE: { grade: "S" | "A" | "B"; desc: string }[] = [
  {
    grade: "S",
    desc: "PSA 9~10 상당 — 민트 상태. 결함 없이 날카로운 모서리와 깨끗한 엣지, 중앙 정렬.",
  },
  {
    grade: "A",
    desc: "PSA 7~8 상당 — 엑셀런트~니어민트. 경미한 결함이나 약간의 모서리·엣지 마모 허용.",
  },
  {
    grade: "B",
    desc: "PSA 5~6 상당 — 굿~엑셀런트. 눈에 띄는 결함이 있으나 감상에는 무리 없는 수준.",
  },
];

// app/listings/new/page.tsx의 GRADE_GUIDE.PSA10/9/8과 동일한 문구.
const PSA_GRADE_GUIDE: { grade: "PSA10" | "PSA9" | "PSA8"; desc: string }[] = [
  { grade: "PSA10", desc: "Gem Mint — 감정사가 완전품으로 판정" },
  { grade: "PSA9", desc: "Mint — 극히 미세한 결점만 존재" },
  { grade: "PSA8", desc: "NM-MT — 육안으로 확인 가능한 경미한 결점 존재" },
];

// 판매/구매입찰 등록 페이지로 넘어가기 전에 한 번 보여주는 등급 안내 모달 — 우리 기준 등급(S/A/B)과
// 공인 PSA 등급을 탭으로 구분해서 설명한다. 등급 확정 로직은 없고, 확인을 누르면 호출부가 알아서
// 등록 페이지로 이동시킨다(onConfirm).
export default function GradeGuideModal({
  isOpen,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [tab, setTab] = useState<GuideTab>("ours");

  useEscapeAndScrollLock(isOpen, onClose);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="등급 안내"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-[420px] flex-col rounded-2xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[16px] font-extrabold">등급 안내</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[18px] font-bold text-[#9A9AA2] hover:bg-neutral"
          >
            ×
          </button>
        </div>

        <div className="mb-4 flex gap-1.5 border-b border-[#F0F0F3] pb-3">
          <button
            type="button"
            onClick={() => setTab("ours")}
            className={`rounded-[9px] px-3.5 py-1.5 text-[13px] font-bold transition ${
              tab === "ours"
                ? "bg-primary text-white"
                : "text-[#8A8A92] hover:bg-neutral hover:text-ink"
            }`}
          >
            우리 기준 등급
          </button>
          <button
            type="button"
            onClick={() => setTab("psa")}
            className={`rounded-[9px] px-3.5 py-1.5 text-[13px] font-bold transition ${
              tab === "psa"
                ? "bg-primary text-white"
                : "text-[#8A8A92] hover:bg-neutral hover:text-ink"
            }`}
          >
            PSA 등급
          </button>
        </div>

        <div className="overflow-y-auto">
          {tab === "ours" ? (
            <div className="flex flex-col gap-3">
              <p className="text-[12.5px] leading-relaxed text-[#8A8A92]">
                PSA 등급을 받기엔 애매하거나, 정식 감정 비용이 부담스러운 카드도 괜찮습니다. 우리
                기준 등급(S/A/B)은 낮은 등급의 카드도 부담 없이 가볍게 거래할 수 있도록
                만들어졌습니다.
              </p>
              {OUR_GRADE_GUIDE.map(({ grade, desc }) => (
                <div key={grade} className="rounded-[11px] border border-[#EDEDF0] p-3.5">
                  <span className="font-bold text-ink">{grade}</span>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-[#4B4B52]">{desc}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-[12.5px] leading-relaxed text-[#8A8A92]">
                PSA(Professional Sports Authenticator)는 카드 상태를 전문적으로 감정하는 공인
                기관입니다.
              </p>
              {PSA_GRADE_GUIDE.map(({ grade, desc }) => (
                <div key={grade} className="rounded-[11px] border border-[#EDEDF0] p-3.5">
                  <span className="font-bold text-ink">{grade}</span>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-[#4B4B52]">{desc}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onConfirm}
          className="mt-5 w-full rounded-[11px] border-2 border-primary-dark bg-primary py-3 text-[14.5px] font-bold text-white shadow-tactile-sm transition active:translate-y-0.5"
        >
          확인
        </button>
      </div>
    </div>,
    document.body,
  );
}
