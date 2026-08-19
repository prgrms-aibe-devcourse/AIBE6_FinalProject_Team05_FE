"use client";

import { useCallback, useEffect, useState, type SyntheticEvent } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import { getMyInfo, sendWithdrawalCode, requestWithdrawal } from "@/lib/authApi";
import { authErrorMessage } from "@/lib/authErrorMessages";
import { MyInfo } from "@/types/auth";

export default function WithdrawalPage() {
  const router = useRouter();
  const logout = useUserStore((s) => s.logout);

  const [info, setInfo] = useState<MyInfo | null>(null);
  const [loadError, setLoadError] = useState(false);

  const [agreed, setAgreed] = useState(false);
  const [password, setPassword] = useState("");

  // 소셜 전용 코드 흐름
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [code, setCode] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(false);
    setInfo(null);
    try {
      setInfo(await getMyInfo());
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트/재시도 시 조회 상태 초기화 후 페치
    load();
  }, [load]);

  // 재발송 쿨다운 카운트다운
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const isLocal = info?.provider === "LOCAL";
  const canSubmit = agreed && !submitting && (isLocal ? password.length > 0 : /^\d{6}$/.test(code));

  const field =
    "w-full rounded-[11px] border border-[#DDDDE3] px-3.5 py-3 text-[14.5px] outline-none";
  const primaryBtn = (enabled: boolean) =>
    `w-full rounded-[11px] border-2 py-3.5 text-[15.5px] font-bold ${
      enabled
        ? "border-[#B41C1C] bg-[#DC2626] text-white shadow-tactile"
        : "cursor-not-allowed border-[#D6D6DC] bg-[#E4E4E8] text-[#A0A0A8]"
    }`;

  async function handleSendCode() {
    if (sending || cooldown > 0) return;
    setError(null);
    setSending(true);
    try {
      await sendWithdrawalCode();
      setSent(true);
      setCooldown(60);
    } catch (e) {
      setError(authErrorMessage(e, "인증 코드 발송에 실패했습니다."));
    } finally {
      setSending(false);
    }
  }

  async function handleWithdraw(e: SyntheticEvent) {
    e.preventDefault();
    if (submitting || !info) return;
    setError(null);
    if (!agreed) {
      setError("안내에 동의해 주세요.");
      return;
    }
    if (isLocal) {
      if (!password) {
        setError("현재 비밀번호를 입력해 주세요.");
        return;
      }
    } else if (!/^\d{6}$/.test(code)) {
      setError("6자리 숫자 코드를 입력해 주세요.");
      return;
    }
    setSubmitting(true);
    try {
      await requestWithdrawal(isLocal ? { password } : { code });
      await logout(); // refresh 무효화 + 클라 상태/힌트플래그 정리
      router.push("/");
    } catch (e) {
      setError(authErrorMessage(e, "회원 탈퇴에 실패했습니다."));
      setSubmitting(false); // 성공 시엔 언마운트되므로 catch에서만 해제
    }
  }

  return (
    <div className="rounded-[18px] border border-[#EDEDF0] bg-white px-8 py-8 shadow-card">
      <h1 className="text-[22px] font-extrabold tracking-[-0.5px]">회원 탈퇴</h1>

      {loadError ? (
        <div className="mt-4 text-center">
          <p role="alert" className="text-[13.5px] font-semibold text-[#C21414]">
            정보를 불러오지 못했습니다.
          </p>
          <button
            onClick={load}
            className="mt-3 rounded-[11px] border-2 border-primary-dark bg-primary px-5 py-2.5 text-[14px] font-bold text-white shadow-tactile"
          >
            다시 시도
          </button>
        </div>
      ) : !info ? (
        <div className="flex h-[160px] items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-[#E7E7EB] border-t-primary" />
        </div>
      ) : (
        <form onSubmit={handleWithdraw}>
          <div className="mt-4 rounded-[12px] border border-[#F6C6C6] bg-[#FFF7F7] px-5 py-4 text-[13px] leading-relaxed text-[#8A4A4A]">
            <p className="font-bold text-[#C21414]">탈퇴 전 확인해 주세요</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>탈퇴 신청 후 7일간 유예되며, 그 사이 다시 로그인해 철회할 수 있습니다.</li>
              <li>7일이 지나면 계정과 데이터가 삭제되며 복구할 수 없습니다.</li>
            </ul>
          </div>

          {isLocal ? (
            <div className="mt-5">
              <label htmlFor="password" className="sr-only">
                현재 비밀번호
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="현재 비밀번호"
                className={field}
              />
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {!sent ? (
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={sending || cooldown > 0}
                  className={primaryBtn(!sending && cooldown === 0)}
                >
                  {sending ? "발송 중…" : "인증 코드 받기"}
                </button>
              ) : (
                <>
                  <label htmlFor="code" className="sr-only">
                    인증 코드
                  </label>
                  <input
                    id="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    placeholder="이메일로 받은 6자리 숫자"
                    className={field}
                  />
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={cooldown > 0 || sending}
                    className="w-full text-[13px] font-semibold text-[#7A7A82] disabled:text-[#B4B4BC]"
                  >
                    {cooldown > 0 ? `코드 재발송 (${cooldown}s)` : "코드 재발송"}
                  </button>
                </>
              )}
            </div>
          )}

          <label className="mt-5 flex cursor-pointer items-start gap-2.5 text-[13px] text-[#4B4B52]">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <span>위 내용을 확인했으며, 7일 유예 후 계정이 삭제되는 것에 동의합니다.</span>
          </label>

          <button type="submit" disabled={!canSubmit} className={`mt-4 ${primaryBtn(canSubmit)}`}>
            {submitting ? "처리 중…" : "회원 탈퇴하기"}
          </button>

          {error && (
            <p
              role="alert"
              className="mt-3 rounded-[11px] border border-[#F6C6C6] bg-[#FFF1F1] px-[15px] py-3 text-[13px] font-semibold text-[#C21414]"
            >
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
