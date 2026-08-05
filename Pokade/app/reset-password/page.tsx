"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { sendPasswordResetCode, confirmPasswordReset } from "@/lib/authApi";
import { authErrorMessage } from "@/lib/authErrorMessages";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // 재발송 쿨다운 카운트다운
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const field =
    "w-full rounded-[11px] border border-[#DDDDE3] px-3.5 py-3 text-[14.5px] outline-none";
  const primaryBtn = (enabled: boolean) =>
    `w-full rounded-[11px] border-2 py-3.5 text-[15.5px] font-bold ${
      enabled
        ? "border-primary-dark bg-primary text-white shadow-tactile"
        : "cursor-not-allowed border-[#D6D6DC] bg-[#E4E4E8] text-[#A0A0A8]"
    }`;

  async function handleSend() {
    if (sending) return;
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("올바른 이메일 형식이 아닙니다.");
      return;
    }
    setSending(true);
    try {
      await sendPasswordResetCode(email.trim());
      setSent(true);
      setCooldown(60);
    } catch (e) {
      setError(authErrorMessage(e, "코드 발송에 실패했습니다."));
    } finally {
      setSending(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || sending) return;
    setError(null);
    setSending(true);
    try {
      await sendPasswordResetCode(email.trim());
      setCooldown(60);
    } catch (e) {
      setError(authErrorMessage(e, "코드 재발송에 실패했습니다."));
    } finally {
      setSending(false);
    }
  }
  async function handleConfirm() {
    if (submitting) return;
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError("6자리 숫자 코드를 입력해 주세요.");
      return;
    }
    if (
      newPassword.length < 8 ||
      newPassword.length > 20 ||
      !/^(?=.*[A-Za-z])(?=.*\d)\S+$/.test(newPassword)
    ) {
      setError("비밀번호는 영문과 숫자를 포함해 8~20자, 공백 없이 입력해 주세요.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    setSubmitting(true);
    try {
      await confirmPasswordReset(email.trim(), code, newPassword);
      setDone(true);
    } catch (e) {
      setError(authErrorMessage(e, "비밀번호 재설정에 실패했습니다."));
    } finally {
      setSubmitting(false);
    }
  }

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
              비밀번호 재설정 완료
            </h1>
            <p className="mt-3 text-[14.5px] leading-relaxed text-[#7A7A82]">
              새 비밀번호로 로그인하실 수 있습니다.
            </p>
            <Link href="/login" className={`mt-[30px] block ${primaryBtn(true)} hover:text-white`}>
              로그인하러 가기
            </Link>
          </div>
        ) : (
          <div>
            <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.6px]">비밀번호 찾기</h1>
            <p className="mt-3 text-[14px] leading-relaxed text-[#7A7A82]">
              가입한 이메일로 인증 코드를 받아 새 비밀번호를 설정하세요.
            </p>

            <label
              htmlFor="email"
              className="mb-[7px] mt-6 block text-[13px] font-bold text-[#4B4B52]"
            >
              이메일
            </label>
            <input
              id="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (sent) setSent(false);
              }}
              placeholder="you@example.com"
              className={field}
            />

            {!sent && (
              <button
                onClick={handleSend}
                disabled={sending}
                className={`mt-3 ${primaryBtn(!sending)}`}
              >
                {sending ? "발송 중…" : "재설정 코드 받기"}
              </button>
            )}

            {sent && (
              <>
                <label
                  htmlFor="code"
                  className="mb-[7px] mt-5 block text-[13px] font-bold text-[#4B4B52]"
                >
                  인증 코드
                </label>
                <input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  placeholder="6자리 숫자"
                  className={field}
                />

                <label
                  htmlFor="newPassword"
                  className="mb-[7px] mt-5 block text-[13px] font-bold text-[#4B4B52]"
                >
                  새 비밀번호
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="영문+숫자 8~20자"
                  className={field}
                />

                <label
                  htmlFor="confirmPassword"
                  className="mb-[7px] mt-5 block text-[13px] font-bold text-[#4B4B52]"
                >
                  새 비밀번호 확인
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="새 비밀번호 재입력"
                  className={field}
                />

                <button
                  onClick={handleConfirm}
                  disabled={submitting}
                  className={`mt-4 ${primaryBtn(!submitting)}`}
                >
                  {submitting ? "처리 중…" : "비밀번호 재설정"}
                </button>

                <button
                  onClick={handleResend}
                  disabled={cooldown > 0 || sending}
                  className="mt-2.5 w-full text-[13px] font-semibold text-[#7A7A82] disabled:text-[#B4B4BC]"
                >
                  {cooldown > 0 ? `코드 재발송 (${cooldown}s)` : "코드 재발송"}
                </button>
              </>
            )}

            {error && (
              <p
                role="alert"
                className="mt-4 rounded-[11px] border border-[#F6C6C6] bg-[#FFF1F1] px-[15px] py-3 text-[13px] font-semibold text-[#C21414]"
              >
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
