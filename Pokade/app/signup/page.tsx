"use client";

import { useState } from "react";
import Link from "next/link";

export default function SignupPage() {
  const [step, setStep] = useState<1 | 3>(1);
  const [birth, setBirth] = useState("");

  const ageError = (() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birth.trim());
    return m ? 2026 - parseInt(m[1], 10) < 14 : false;
  })();

  const field =
    "w-full rounded-[11px] border border-[#DDDDE3] px-3.5 py-3 text-[14.5px] outline-none";

  return (
    <main className="main-content flex items-start justify-center bg-neutral px-10 py-12">
      <div className="w-full max-w-[480px] rounded-[18px] border border-[#EDEDF0] bg-white px-10 pb-9 pt-10 shadow-card">
        {step === 1 && (
          <div>
            {/* Line 1: phase label */}
            <div className="text-[12.5px] font-extrabold tracking-[1px] text-secondary">1단계</div>
            {/* Line 2 (12px gap): headline + counter (>=40px gap) */}
            <div className="mt-3 flex items-baseline justify-between gap-10">
              <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.6px]">계정 만들기</h1>
              <span className="whitespace-nowrap text-[13px] font-bold text-[#8A8A92]">
                1/3 단계
              </span>
            </div>
            {/* Line 3 (16px gap): progress bar + labels */}
            <div className="mt-4">
              <div className="flex gap-1.5">
                <div className="h-1.5 flex-1 rounded bg-secondary" />
                <div className="h-1.5 flex-1 rounded bg-[#E2E2E8]" />
                <div className="h-1.5 flex-1 rounded bg-[#E2E2E8]" />
              </div>
              <div className="mt-2 flex gap-1.5">
                <div className="flex-1 text-center text-xs font-bold text-secondary">정보입력</div>
                <div className="flex-1 text-center text-xs font-semibold text-[#A8A8B0]">인증</div>
                <div className="flex-1 text-center text-xs font-semibold text-[#A8A8B0]">
                  가입완료
                </div>
              </div>
            </div>

            <div className="h-[30px]" />

            {ageError && (
              <div className="mb-5 flex items-center gap-2.5 rounded-[11px] border border-[#F6C6C6] bg-[#FFF1F1] px-[15px] py-[13px]">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#EE1515"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
                <span className="text-[13.5px] font-bold text-[#C21414]">
                  만 14세 이상만 가입 가능합니다
                </span>
              </div>
            )}

            <label className="mb-[7px] block text-[13px] font-bold text-[#4B4B52]">이메일</label>
            <input placeholder="you@example.com" className={field} />
            <div className="h-4" />
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-[7px] block text-[13px] font-bold text-[#4B4B52]">
                  비밀번호
                </label>
                <input type="password" placeholder="8자 이상" className={field} />
              </div>
              <div className="flex-1">
                <label className="mb-[7px] block text-[13px] font-bold text-[#4B4B52]">
                  비밀번호 확인
                </label>
                <input type="password" placeholder="다시 입력" className={field} />
              </div>
            </div>
            <div className="h-4" />
            <label className="mb-[7px] block text-[13px] font-bold text-[#4B4B52]">닉네임</label>
            <input placeholder="트레이너 닉네임" className={field} />
            <div className="h-4" />
            <label className="mb-[7px] block text-[13px] font-bold text-[#4B4B52]">생년월일</label>
            <input
              placeholder="YYYY-MM-DD"
              value={birth}
              onChange={(e) => setBirth(e.target.value)}
              className={`w-full rounded-[11px] border px-3.5 py-3 text-[14.5px] outline-none ${ageError ? "border-[1.5px] border-primary bg-[#FFF6F6]" : "border-[#DDDDE3]"}`}
            />
            {ageError && (
              <p className="mt-[9px] text-[12.5px] font-semibold text-primary">
                가입 연령 기준을 충족하지 않습니다.
              </p>
            )}

            <button
              onClick={() => {
                if (!ageError) setStep(3);
              }}
              disabled={ageError}
              className={`mt-[26px] w-full rounded-[11px] border-2 py-3.5 text-[15.5px] font-bold ${
                ageError
                  ? "cursor-not-allowed border-[#D6D6DC] bg-[#E4E4E8] text-[#A0A0A8]"
                  : "border-primary-dark bg-primary text-white shadow-tactile"
              }`}
            >
              다음 단계 →
            </button>
            <p className="mt-4 text-center text-xs text-[#B0B0B8]">
              데모: 생년월일에 2013-05-05 입력 시 연령 제한 상태 확인
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="py-2 text-center">
            <div className="mx-auto flex h-[76px] w-[76px] items-center justify-center rounded-full bg-[#E8F7EF]">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#059669"
                strokeWidth="2.5"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <div className="mt-[18px] text-[12.5px] font-extrabold tracking-[1px] text-[#059669]">
              가입 완료
            </div>
            <h1 className="mt-2.5 text-[26px] font-extrabold tracking-[-0.6px]">
              환영합니다, 트레이너님!
            </h1>
            <p className="mt-3 text-[14.5px] leading-relaxed text-[#7A7A82]">
              이제 PocketTrade의 모든 기능을 이용하실 수 있습니다.
              <br />
              가입 축하 AI 진단 3회가 지급되었습니다.
            </p>
            <Link
              href="/login"
              className="mt-[30px] block w-full rounded-[11px] border-2 border-primary-dark bg-primary py-3.5 text-[15.5px] font-bold text-white shadow-tactile hover:text-white"
            >
              로그인하러 가기
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
