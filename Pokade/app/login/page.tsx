"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import { ApiError } from "@/lib/apiClient";

export default function LoginPage() {
  const router = useRouter();
  const login = useUserStore((s) => s.login);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const inputCls = `w-full rounded-[11px] px-3.5 py-3 text-[14.5px] text-ink outline-none border ${
    error ? "border-[1.5px] border-primary bg-[#FFF6F6]" : "border-[#DDDDE3]"
  }`;

  const doLogin = async (loginEmail: string, loginPassword: string) => {
    setError(null);
    setLoading(true);
    try {
      await login(loginEmail, loginPassword);
      router.push("/"); // 로그인 성공 → 홈으로
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doLogin(email, password);
  };

  return (
    <main className="main-content flex items-center justify-center bg-neutral px-10 py-14">
      <div className="w-full max-w-[420px] rounded-[18px] border border-[#EDEDF0] bg-white px-[34px] py-9 shadow-card">
        <div className="mb-[26px] text-center">
          <div className="text-[22px] font-extrabold tracking-[-0.5px] text-primary">
            POCKET TRADE
          </div>
          <p className="mt-2 text-sm text-[#8A8A92]">컬렉터를 위한 안전한 카드 거래</p>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="mb-[7px] block text-[13px] font-bold text-[#4B4B52]">이메일</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={inputCls}
          />
          <div className="h-4" />
          <label className="mb-[7px] block text-[13px] font-bold text-[#4B4B52]">비밀번호</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호를 입력하세요"
            className={inputCls}
          />
          {error && <p className="mt-[9px] text-[12.5px] font-semibold text-primary">{error}</p>}
          <div className="mt-3.5 flex justify-end">
            <Link
              href="#"
              className="text-[12.5px] font-semibold text-[#8A8A92] hover:text-primary"
            >
              비밀번호 찾기
            </Link>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-[18px] w-full rounded-[11px] border-2 border-primary-dark bg-primary py-3.5 text-[15.5px] font-bold text-white shadow-tactile transition active:translate-y-0.5 active:shadow-tactile-active disabled:opacity-60"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        {process.env.NODE_ENV === "development" && (
          <button
            type="button"
            onClick={() => doLogin("test1@pokade.com", "test1234")}
            disabled={loading}
            className="mt-3 w-full rounded-[11px] border border-dashed border-[#B0B0B8] bg-[#F7F7F9] py-2.5 text-[13px] font-bold text-[#6E6E76] hover:bg-[#EFEFF2] disabled:opacity-60"
          >
            🧪 테스트 계정(test1)으로 로그인 · dev 전용
          </button>
        )}

        {process.env.NODE_ENV === "development" && (
          <button
            type="button"
            onClick={() => doLogin("test2@pokade.com", "test1234")}
            disabled={loading}
            className="mt-3 w-full rounded-[11px] border border-dashed border-[#B0B0B8] bg-[#F7F7F9] py-2.5 text-[13px] font-bold text-[#6E6E76] hover:bg-[#EFEFF2] disabled:opacity-60"
          >
            🧪 테스트 계정(test2)으로 로그인 · dev 전용
          </button>
        )}

        {/* 간편 로그인 — BE OAuth 미구현이라 비활성 */}
        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-[#EDEDF0]" />
          <span className="text-xs font-semibold text-[#B0B0B8]">간편 로그인</span>
          <div className="h-px flex-1 bg-[#EDEDF0]" />
        </div>
        <button
          disabled
          title="준비중"
          className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-[11px] border border-[#E8D000] bg-[#FEE500] py-3 text-[14.5px] font-bold text-[#191600] opacity-60"
        >
          <span className="text-base">💬</span>카카오로 로그인 (준비중)
        </button>
        <div className="h-2.5" />
        <button
          disabled
          title="준비중"
          className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-[11px] border border-[#DADCE0] bg-white py-3 text-[14.5px] font-bold text-[#3C4043] opacity-60"
        >
          <span className="font-extrabold text-[#4285F4]">G</span>Google로 로그인 (준비중)
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
