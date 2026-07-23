"use client";

import { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const [error, setError] = useState(false);

  const inputCls = `w-full rounded-[11px] px-3.5 py-3 text-[14.5px] text-ink outline-none border ${
    error ? "border-[1.5px] border-primary bg-[#FFF6F6]" : "border-[#DDDDE3]"
  }`;

  return (
    <main className="main-content flex items-center justify-center bg-neutral px-10 py-14">
      <div className="w-full max-w-[420px] rounded-[18px] border border-[#EDEDF0] bg-white px-[34px] py-9 shadow-card">
        <div className="mb-[26px] text-center">
          <div className="text-[22px] font-extrabold tracking-[-0.5px] text-primary">
            POCKET TRADE
          </div>
          <p className="mt-2 text-sm text-[#8A8A92]">컬렉터를 위한 안전한 카드 거래</p>
        </div>

        {/* 이메일 로그인 폼 */}
        <label className="mb-[7px] block text-[13px] font-bold text-[#4B4B52]">이메일</label>
        <input placeholder="you@example.com" className={inputCls} />
        <div className="h-4" />
        <label className="mb-[7px] block text-[13px] font-bold text-[#4B4B52]">비밀번호</label>
        <input
          type="password"
          placeholder="비밀번호를 입력하세요"
          defaultValue={error ? "wrongpass" : ""}
          className={inputCls}
        />
        {error && (
          <p className="mt-[9px] text-[12.5px] font-semibold text-primary">
            이메일 또는 비밀번호가 올바르지 않습니다.
          </p>
        )}
        <div className="mt-3.5 flex justify-end">
          <Link href="#" className="text-[12.5px] font-semibold text-[#8A8A92] hover:text-primary">
            비밀번호 찾기
          </Link>
        </div>
        <button
          onClick={() => setError((e) => !e)}
          className="mt-[18px] w-full rounded-[11px] border-2 border-primary-dark bg-primary py-3.5 text-[15.5px] font-bold text-white shadow-tactile transition active:translate-y-0.5 active:shadow-tactile-active"
        >
          로그인
        </button>

        {/* 간편 로그인 */}
        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-[#EDEDF0]" />
          <span className="text-xs font-semibold text-[#B0B0B8]">간편 로그인</span>
          <div className="h-px flex-1 bg-[#EDEDF0]" />
        </div>
        <button className="flex w-full items-center justify-center gap-2 rounded-[11px] border border-[#E8D000] bg-[#FEE500] py-3 text-[14.5px] font-bold text-[#191600] hover:brightness-[0.97]">
          <span className="text-base">💬</span>카카오로 로그인
        </button>
        <div className="h-2.5" />
        <button className="flex w-full items-center justify-center gap-2 rounded-[11px] border border-[#DADCE0] bg-white py-3 text-[14.5px] font-bold text-[#3C4043] hover:bg-[#F8F9FA]">
          <span className="font-extrabold text-[#4285F4]">G</span>Google로 로그인
        </button>

        <p className="mt-6 text-center text-[13.5px] text-[#8A8A92]">
          아직 회원이 아니신가요?{" "}
          <Link href="/signup" className="font-bold text-primary hover:text-primary-dark">
            회원가입
          </Link>
        </p>
      </div>
    </main>
  );
}
