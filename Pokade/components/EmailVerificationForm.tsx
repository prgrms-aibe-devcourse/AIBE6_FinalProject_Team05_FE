"use client";

import { useEffect, useState } from "react";
import { sendEmailCode, verifyEmail } from "@/lib/authApi";
import { authErrorMessage } from "@/lib/authErrorMessages";

interface EmailVerificationFormProps {
  email: string;
  onVerified: () => void;
  initialCooldown?: number;
}

export default function EmailVerificationForm({
  email,
  onVerified,
  initialCooldown = 0,
}: EmailVerificationFormProps) {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(initialCooldown);
  const [error, setError] = useState<string | null>(null);

  // 재발송 쿨다운 카운트다운
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const field =
    "w-full rounded-[11px] border border-[#DDDDE3] px-3.5 py-3 text-[14.5px] outline-none";

  const primaryBtn = (enabled: boolean) =>
    `w-full rounded-[11px] border-2 py-3.5 text-[15.5px] font-bold ${
      enabled
        ? "border-primary-dark bg-primary text-white shadow-tactile"
        : "cursor-not-allowed border-[#D6D6DC] bg-[#E4E4E8] text-[#A0A0A8]"
    }`;

  async function handleVerify() {
    if (verifying || resending) return;
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError("6자리 숫자 코드를 입력해 주세요.");
      return;
    }
    setVerifying(true);
    try {
      await verifyEmail(email.trim(), code);
      onVerified();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0 || verifying || resending) return;
    setError(null);
    setResending(true);
    try {
      await sendEmailCode(email.trim());
      setResendCooldown(60);
    } catch (e) {
      setError(authErrorMessage(e, "코드 재발송에 실패했습니다."));
    } finally {
      setResending(false);
    }
  }

  return (
    <>
      <label htmlFor="code" className="mb-[7px] mt-6 block text-[13px] font-bold text-[#4B4B52]">
        인증 코드
      </label>
      <input
        id="code"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        placeholder="6자리 숫자"
        className={`${field} text-center text-[20px] tracking-[8px]`}
      />

      <button
        onClick={handleVerify}
        disabled={verifying || resending}
        className={`mt-[18px] ${primaryBtn(!verifying && !resending)}`}
      >
        {verifying ? "확인 중…" : "인증 확인"}
      </button>

      <button
        onClick={handleResend}
        disabled={resendCooldown > 0 || verifying || resending}
        className="mt-3 w-full text-[13px] font-semibold text-secondary disabled:text-[#B0B0B8]"
      >
        {resendCooldown > 0 ? `코드 재발송 (${resendCooldown}s)` : "코드 재발송"}
      </button>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-[11px] border border-[#F6C6C6] bg-[#FFF1F1] px-[15px] py-3 text-[13px] font-semibold text-[#C21414]"
        >
          {error}
        </p>
      )}
    </>
  );
}
