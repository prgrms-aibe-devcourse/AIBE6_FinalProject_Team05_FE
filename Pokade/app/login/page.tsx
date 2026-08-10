"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import { ApiError } from "@/lib/apiClient";
import { authErrorMessage } from "@/lib/authErrorMessages";
import { API_BASE_URL } from "@/lib/apiClient";

// redirect 쿼리로 임의 도메인 이동(오픈 리다이렉트)을 허용하지 않도록, "/"로 시작하는
// 내부 경로만 허용한다("//evil.com"처럼 프로토콜-상대 URL로 해석되는 경우도 차단).
function sanitizeRedirect(target: string | null): string {
  if (target && target.startsWith("/") && !target.startsWith("//")) {
    return target;
  }
  return "/";
}

// useSearchParams는 정적 프리렌더 시 Suspense 경계를 요구함(next build에서 강제됨)
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useUserStore((s) => s.login);
  const authStatus = useUserStore((s) => s.status);

  // 이미 로그인된 상태로 /login에 진입(예: 로그인 후 뒤로가기)하면 로그인 폼 대신 바로 원래 목적지로 보낸다.
  // replace를 써서 히스토리에 /login이 다시 쌓이지 않게 한다.
  useEffect(() => {
    if (authStatus === "authenticated") {
      router.replace(sanitizeRedirect(searchParams.get("redirect")));
    }
  }, [authStatus, router, searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needVerify, setNeedVerify] = useState(false);

  const inputCls = `w-full rounded-[11px] px-3.5 py-3 text-[14.5px] text-ink outline-none border ${
    error ? "border-[1.5px] border-primary bg-[#FFF6F6]" : "border-[#DDDDE3]"
  }`;

  const doLogin = async (loginEmail: string, loginPassword: string) => {
    setNeedVerify(false);
    setError(null);
    setLoading(true);
    try {
      await login(loginEmail, loginPassword);
      // replace로 이동 — push를 쓰면 히스토리에 /login이 남아 로그인 후 뒤로가기 시 다시 노출된다
      router.replace(sanitizeRedirect(searchParams.get("redirect"))); // 로그인 성공 → 원래 가려던 페이지(없으면 홈)로
    } catch (err) {
      if (err instanceof ApiError && err.code === "EMAIL_NOT_VERIFIED") {
        setError("이메일 인증이 완료되지 않았습니다");
        setNeedVerify(true);
        sessionStorage.setItem("pendingVerifyEmail", loginEmail); // 인증 페이지에서 이메일 자동 채움
      } else {
        setError(authErrorMessage(err, "로그인에 실패했습니다."));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("이메일과 비밀번호를 입력해 주세요.");
      return;
    }
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
          <label htmlFor="email" className="mb-[7px] block text-[13px] font-bold text-[#4B4B52]">
            이메일
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={inputCls}
          />
          <div className="h-4" />
          <label htmlFor="password" className="mb-[7px] block text-[13px] font-bold text-[#4B4B52]">
            비밀번호
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호를 입력하세요"
            className={inputCls}
          />
          {error && (
            <p role="alert" className="mt-[9px] text-[12.5px] font-semibold text-primary">
              {error}
            </p>
          )}

          {needVerify && (
            <button
              type="button"
              onClick={() => router.push("/verify-email")}
              className="mt-3 w-full rounded-[11px] border-2 border-primary bg-[#FFF6F6] py-3 text-[14px] font-bold text-primary"
            >
              이메일 인증하러 가기 →
            </button>
          )}

          <div className="mt-3.5 flex justify-end">
            <Link
              href="/reset-password"
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

        <button
          type="button"
          onClick={() => {
            window.location.href = `${API_BASE_URL}/api/oauth2/authorization/kakao`;
          }}
          className="flex w-full items-center justify-center gap-2 rounded-[11px] border border-[#E8D000] bg-[#FEE500] py-3 text-[14.5px] font-bold text-[#191600] transition active:translate-y-0.5"
        >
          <span className="text-base">💬</span>카카오로 로그인
        </button>
        <div className="h-2.5" />
        <button
          type="button"
          onClick={() => {
            window.location.href = `${API_BASE_URL}/api/oauth2/authorization/google`;
          }}
          className="flex w-full items-center justify-center gap-2 rounded-[11px] border border-[#DADCE0] bg-white py-3 text-[14.5px] font-bold text-[#3C4043] transition active:translate-y-0.5"
        >
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
