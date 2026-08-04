"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { sendEmailCode, verifyEmail } from "@/lib/authApi";
import { ApiError } from "@/lib/apiClient";

export default function VerifyEmailPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // 로그인/회원가입에서 넘긴 이메일 자동 채움
  useEffect(() => {
    const pending = sessionStorage.getItem("pendingVerifyEmail");
    if (pending) setEmail(pending);
  }, []);

  // 재발송 쿨다운 카운트다운
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const field =
    "w-full rounded-[11px] border border-[#DDDDE3] px-3.5 py-3 text-[14.5px] outline-none";

  function messageForError(e: ApiError): string {
    switch (e.code) {
      case "USER_NOT_FOUND":
        return "가입되지 않은 이메일입니다.";
      case "EMAIL_ALREADY_VERIFIED":
        return "이미 인증이 완료된 계정입니다. 로그인해 주세요.";
      case "EMAIL_SEND_RATE_LIMITED":
        return "인증 코드는 잠시 후에 다시 요청해 주세요.";
      case "EMAIL_CODE_MISMATCH":
        return "인증 코드가 일치하지 않습니다.";
      case "EMAIL_CODE_EXPIRED":
        return "인증 코드가 만료되었습니다. 코드를 재발송해 주세요.";
      case "EMAIL_VERIFY_ATTEMPT_EXCEEDED":
        return "인증 시도 횟수를 초과했습니다. 코드를 재발송해 주세요.";
      default:
        return e.message;
    }
  }

  async function handleSend() {
    if (resendCooldown > 0 || sending) return;
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("올바른 이메일 형식이 아닙니다.");
      return;
    }
    setSending(true);
    try {
      await sendEmailCode(email.trim());
      setSent(true);
      setResendCooldown(60);
    } catch (e) {
      setError(e instanceof ApiError ? messageForError(e) : "코드 발송에 실패했습니다.");
    } finally {
      setSending(false);
    }
  }

  async function handleVerify() {
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError("6자리 숫자 코드를 입력해 주세요.");
      return;
    }
    setVerifying(true);
    try {
      await verifyEmail(email.trim(), code);
      sessionStorage.removeItem("pendingVerifyEmail");
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? messageForError(e) : "인증에 실패했습니다.");
    } finally {
      setVerifying(false);
    }
  }

  const primaryBtn = (enabled: boolean) =>
    `w-full rounded-[11px] border-2 py-3.5 text-[15.5px] font-bold ${
      enabled
        ? "border-primary-dark bg-primary text-white shadow-tactile"
        : "cursor-not-allowed border-[#D6D6DC] bg-[#E4E4E8] text-[#A0A0A8]"
    }`;

  return (
    <main className="main-content flex items-start justify-center bg-neutral px-10 py-12">
      <div className="w-full max-w-[480px] rounded-[18px] border border-[#EDEDF0] bg-white px-10 pb-9 pt-10 shadow-card">
        {done ? (
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
            <h1 className="mt-[18px] text-[26px] font-extrabold tracking-[-0.6px]">
              이메일 인증 완료
            </h1>
            <p className="mt-3 text-[14.5px] leading-relaxed text-[#7A7A82]">
              이제 로그인하실 수 있습니다.
            </p>
            <Link href="/login" className={`mt-[30px] block ${primaryBtn(true)} hover:text-white`}>
              로그인하러 가기
            </Link>
          </div>
        ) : (
          <div>
            <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.6px]">이메일 인증</h1>
            <p className="mt-3 text-[14px] leading-relaxed text-[#7A7A82]">
              가입에 사용한 이메일로 인증 코드를 받아 입력해 주세요.
            </p>

            <label className="mb-[7px] mt-6 block text-[13px] font-bold text-[#4B4B52]">
              이메일
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={field}
            />

            <button
              onClick={handleSend}
              disabled={resendCooldown > 0 || sending}
              className={`mt-3 ${primaryBtn(!(resendCooldown > 0 || sending))}`}
            >
              {sending
                ? "발송 중…"
                : resendCooldown > 0
                  ? `재발송 (${resendCooldown}s)`
                  : sent
                    ? "코드 재발송"
                    : "인증코드 받기"}
            </button>

            {sent && (
              <>
                <label className="mb-[7px] mt-6 block text-[13px] font-bold text-[#4B4B52]">
                  인증 코드
                </label>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  placeholder="6자리 숫자"
                  className={`${field} text-center text-[20px] tracking-[8px]`}
                />
                <button
                  onClick={handleVerify}
                  disabled={verifying}
                  className={`mt-[18px] ${primaryBtn(!verifying)}`}
                >
                  {verifying ? "확인 중…" : "인증 확인"}
                </button>
              </>
            )}

            {error && (
              <p className="mt-4 rounded-[11px] border border-[#F6C6C6] bg-[#FFF1F1] px-[15px] py-3 text-[13px] font-semibold text-[#C21414]">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
