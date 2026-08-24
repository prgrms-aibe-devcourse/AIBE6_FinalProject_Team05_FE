"use client";

import { useState } from "react";
import Link from "next/link";
import { signup, sendEmailCode } from "@/lib/authApi";
import { useRouter } from "next/navigation";
import { ApiError, API_BASE_URL } from "@/lib/apiClient";
import { authErrorInfo, type AuthErrorInfo } from "@/lib/authErrorMessages";
import { nicknameError } from "@/lib/nickname";
import EmailVerificationForm from "@/components/EmailVerificationForm";
import AgreementSection, {
  Agreements,
  EMPTY_AGREEMENTS,
  isRequiredAgreed,
} from "@/components/AgreementSection";

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [nickname, setNickname] = useState("");
  const [birth, setBirth] = useState("");
  const [signedUp, setSignedUp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setErrorState] = useState<AuthErrorInfo | null>(null);
  const [needVerify, setNeedVerify] = useState(false);

  // 입력 검증 실패는 전부 사용자가 고칠 수 있는 오류라 문자열을 그대로 받는다.
  // 통신 오류만 authErrorInfo로 분류해 넘긴다(#282).
  const setError = (e: string | AuthErrorInfo | null) =>
    setErrorState(typeof e === "string" ? { kind: "credential", message: e } : e);
  const [agreements, setAgreements] = useState<Agreements>(EMPTY_AGREEMENTS);

  // 생년월일 완성 여부 + 만 나이(월·일까지) 계산
  const birthValid = /^\d{4}-\d{2}-\d{2}$/.test(birth.trim());
  const age = (() => {
    if (!birthValid) return null;
    const [y, m, d] = birth.trim().split("-").map(Number);
    const today = new Date();
    let a = today.getFullYear() - y;
    const beforeBirthday =
      today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d);
    if (beforeBirthday) a -= 1;
    return a;
  })();
  const ageError = age !== null && age < 14;

  const passwordMismatch = passwordConfirm.length > 0 && password !== passwordConfirm;

  async function handleStep1Submit() {
    setError(null);
    setNeedVerify(false);

    // 클라 전용 검증 (BE 제약과 동일하게 선반영 — 왕복 줄이기)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("올바른 이메일 형식이 아닙니다.");
      return;
    }
    if (!/^(?=.*[A-Za-z])(?=.*\d)\S{8,20}$/.test(password)) {
      setError("비밀번호는 영문과 숫자를 포함해 공백 없이 8~20자로 입력해 주세요.");
      return;
    }
    if (!birthValid) {
      setError("생년월일을 입력해 주세요.");
      return;
    }
    if (ageError) {
      setError("만 14세 이상만 가입 가능합니다.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    const nicknameProblem = nicknameError(nickname);
    if (nicknameProblem) {
      setError(nicknameProblem);
      return;
    }
    // 버튼도 막고 있지만 BE와 같은 조건을 여기서 한 번 더 본다 — 미동의로 요청이 나가면 400이다.
    if (!isRequiredAgreed(agreements)) {
      setError("필수 약관에 모두 동의해 주세요.");
      return;
    }

    setSubmitting(true);
    try {
      // signup은 한 번만 (send 실패 후 재시도 시 DUPLICATE_EMAIL 방지)
      if (!signedUp) {
        await signup({
          email: email.trim(),
          password,
          nickname,
          ...agreements, // 키가 BE 요청 필드명과 같아 변환 없이 그대로 넘긴다
        });
        setSignedUp(true);
      }
      await sendEmailCode(email.trim());
      setStep(2);
    } catch (e) {
      if (e instanceof ApiError && e.code === "EMAIL_NOT_VERIFIED") {
        setError("이미 가입된 이메일입니다. 이메일 인증을 완료해 주세요.");
        setNeedVerify(true);
        sessionStorage.setItem("pendingVerifyEmail", email.trim());
      } else {
        setError(authErrorInfo(e));
      }
    } finally {
      setSubmitting(false);
    }
  }

  // 숫자만 남겨 YYYY-MM-DD 형식으로 자동 포맷팅
  function formatBirth(input: string): string {
    const digits = input.replace(/\D/g, "").slice(0, 8);
    const parts = [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8)].filter(Boolean);
    return parts.join("-");
  }

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
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={field}
            />
            <div className="h-4" />
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-[7px] block text-[13px] font-bold text-[#4B4B52]">
                  비밀번호
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8자 이상"
                  className={field}
                />
              </div>
              <div className="flex-1">
                <label className="mb-[7px] block text-[13px] font-bold text-[#4B4B52]">
                  비밀번호 확인
                </label>
                <input
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="다시 입력"
                  className={field}
                />
                {passwordMismatch && (
                  <p className="mt-[7px] text-[12px] font-semibold text-primary">
                    비밀번호가 일치하지 않습니다.
                  </p>
                )}
              </div>
            </div>
            <div className="h-4" />
            <label className="mb-[7px] block text-[13px] font-bold text-[#4B4B52]">닉네임</label>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="닉네임"
              className={field}
            />
            <div className="h-4" />
            <label className="mb-[7px] block text-[13px] font-bold text-[#4B4B52]">생년월일</label>
            <input
              placeholder="YYYY-MM-DD"
              value={birth}
              onChange={(e) => setBirth(formatBirth(e.target.value))}
              inputMode="numeric"
              maxLength={10}
              className={`w-full rounded-[11px] border px-3.5 py-3 text-[14.5px] outline-none ${ageError ? "border-[1.5px] border-primary bg-[#FFF6F6]" : "border-[#DDDDE3]"}`}
            />
            {ageError && (
              <p className="mt-[9px] text-[12.5px] font-semibold text-primary">
                가입 연령 기준을 충족하지 않습니다.
              </p>
            )}

            <div className="mt-[22px]">
              <AgreementSection value={agreements} onChange={setAgreements} />
            </div>

            {error?.kind === "connection" ? (
              // 통신 오류는 입력 문제가 아니다. 빨간 경고 대신 중립 톤 + 재시도 수단을 준다.
              <div
                role="alert"
                className="mt-4 rounded-[11px] border border-[#DDDDE3] bg-[#F7F7F8] px-[15px] py-3"
              >
                <p className="text-[13px] font-semibold text-[#4B4B52]">{error.message}</p>
                <button
                  type="button"
                  onClick={handleStep1Submit}
                  disabled={submitting}
                  className="mt-2 text-[12.5px] font-bold text-secondary underline underline-offset-2 disabled:text-[#A0A0A8] disabled:no-underline"
                >
                  {submitting ? "다시 시도하는 중…" : "다시 시도"}
                </button>
              </div>
            ) : (
              error && (
                <p
                  role="alert"
                  className="mt-4 rounded-[11px] border border-[#F6C6C6] bg-[#FFF1F1] px-[15px] py-3 text-[13px] font-semibold text-[#C21414]"
                >
                  {error.message}
                </p>
              )
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
            <button
              onClick={handleStep1Submit}
              disabled={ageError || submitting || !isRequiredAgreed(agreements)}
              className={`mt-[26px] w-full rounded-[11px] border-2 py-3.5 text-[15.5px] font-bold ${
                ageError || submitting || !isRequiredAgreed(agreements)
                  ? "cursor-not-allowed border-[#D6D6DC] bg-[#E4E4E8] text-[#A0A0A8]"
                  : "border-primary-dark bg-primary text-white shadow-tactile"
              }`}
            >
              {submitting ? "처리 중…" : "다음 단계 →"}
            </button>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-[#EDEDF0]" />
              <span className="text-[12px] font-semibold text-[#B0B0B8]">또는</span>
              <div className="h-px flex-1 bg-[#EDEDF0]" />
            </div>

            {/* 같은 엔드포인트가 계정 유무에 따라 로그인·가입으로 갈리므로 "가입"이 아니라 "시작"으로 적는다. */}
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => {
                  window.location.href = `${API_BASE_URL}/api/oauth2/authorization/kakao`;
                }}
                className="flex w-full items-center justify-center gap-2 rounded-[11px] border border-[#E8D000] bg-[#FEE500] py-3 text-[14.5px] font-bold text-[#191600] transition active:translate-y-0.5"
              >
                <span className="text-base">💬</span>카카오로 시작하기
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.href = `${API_BASE_URL}/api/oauth2/authorization/google`;
                }}
                className="flex w-full items-center justify-center gap-2 rounded-[11px] border border-[#DADCE0] bg-white py-3 text-[14.5px] font-bold text-[#3C4043] transition active:translate-y-0.5"
              >
                <span className="font-extrabold text-[#4285F4]">G</span>Google로 시작하기
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="text-[12.5px] font-extrabold tracking-[1px] text-secondary">2단계</div>
            <div className="mt-3 flex items-baseline justify-between gap-10">
              <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.6px]">이메일 인증</h1>
              <span className="whitespace-nowrap text-[13px] font-bold text-[#8A8A92]">
                2/3 단계
              </span>
            </div>
            <div className="mt-4 flex gap-1.5">
              <div className="h-1.5 flex-1 rounded bg-secondary" />
              <div className="h-1.5 flex-1 rounded bg-secondary" />
              <div className="h-1.5 flex-1 rounded bg-[#E2E2E8]" />
            </div>

            <p className="mt-6 text-[14px] leading-relaxed text-[#7A7A82]">
              <span className="font-bold text-[#4B4B52]">{email}</span> 으로
              <br />
              인증 코드 6자리를 보냈습니다.
            </p>

            <EmailVerificationForm
              email={email}
              onVerified={() => setStep(3)}
              initialCooldown={60}
            />
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
              이제 Pokade의 모든 기능을 이용하실 수 있습니다.
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
