"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import { oauth2Register } from "@/lib/authApi";
import { isValidNickname, nicknameError } from "@/lib/nickname";
import { authErrorInfo, type AuthErrorInfo } from "@/lib/authErrorMessages";
import AgreementSection, {
  Agreements,
  EMPTY_AGREEMENTS,
  isRequiredAgreed,
} from "@/components/AgreementSection";

export default function SocialSignupPage() {
  const router = useRouter();
  const loginWithToken = useUserStore((s) => s.loginWithToken);
  const [ticket, setTicket] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [agreements, setAgreements] = useState<Agreements>(EMPTY_AGREEMENTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AuthErrorInfo | null>(null);

  // 마운트 시 URL fragment(#ticket=)에서 티켓 추출 + URL에서 제거(노출 방지)
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    const t = new URLSearchParams(hash).get("ticket");
    if (!t) {
      router.replace("/login?error=oauth2_failed");
      return;
    }
    // URL fragment는 브라우저에서만 읽히므로 effect에서 1회 파싱해 상태에 반영한다.
    // (lazy init으로 옮기면 SSR/hydration 불일치가 나서, 이 케이스는 effect가 맞음)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTicket(t);
    window.history.replaceState(null, "", window.location.pathname);
  }, [router]);

  const onSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!ticket) return;
    const nicknameProblem = nicknameError(nickname);
    if (nicknameProblem) {
      setError({ kind: "credential", message: nicknameProblem });
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { accessToken } = await oauth2Register({ ticket, nickname, ...agreements });
      await loginWithToken(accessToken);
      router.replace("/");
    } catch (err) {
      setError(authErrorInfo(err, "가입에 실패했습니다."));
      setLoading(false);
    }
  };

  if (!ticket) return null; // 티켓 파싱 전/실패 시 렌더 생략

  // 컨테이너는 /login·/signup과 같은 것을 쓴다. main-content(flex-1)가 없으면 본문이 남은 공간을
  // 차지하지 못해 푸터가 화면 하단에 붙지 않고 콘텐츠 바로 밑에 딸려 올라온다.
  return (
    <main className="main-content flex items-start justify-center bg-neutral px-4 py-12 sm:px-10">
      <div className="w-full max-w-[420px] rounded-[18px] border border-[#EDEDF0] bg-white px-[34px] py-9 shadow-card">
        <h1 className="m-0 text-[22px] font-extrabold tracking-[-0.4px]">소셜 회원가입</h1>
        <p className="mt-2 text-[13.5px] text-[#8A8A92]">
          닉네임과 약관 동의만 입력하면 가입이 완료됩니다.
        </p>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <div>
            {/* placeholder만으로는 입력 목적이 보조기술에 안정적으로 전달되지 않는다.
                /signup의 닉네임 칸과 같은 방식으로 label을 붙인다. */}
            <label
              htmlFor="social-signup-nickname"
              className="mb-[7px] block text-[13px] font-bold text-[#4B4B52]"
            >
              닉네임
            </label>
            <input
              id="social-signup-nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="닉네임 (2~20자)"
              minLength={2}
              maxLength={20}
              required
              className="w-full rounded-[11px] border border-[#DDDDE3] px-3.5 py-3 text-[14.5px] outline-none focus:border-primary"
            />
          </div>
          <AgreementSection value={agreements} onChange={setAgreements} />

          {/* 오류 표시는 /login·/signup과 같은 규칙을 따른다(#282) — 통신 오류는 사용자가 고칠 것이
              없으므로 빨간 경고 대신 중립 톤 + 재시도 수단을 준다. */}
          {error?.kind === "connection" ? (
            <div
              role="alert"
              className="rounded-[11px] border border-[#DDDDE3] bg-[#F7F7F8] px-[15px] py-3"
            >
              <p className="text-[13px] font-semibold text-[#4B4B52]">{error.message}</p>
              <button
                type="button"
                onClick={() => onSubmit()}
                disabled={loading}
                className="mt-2 text-[12.5px] font-bold text-secondary underline underline-offset-2 disabled:text-[#A0A0A8] disabled:no-underline"
              >
                {loading ? "다시 시도하는 중…" : "다시 시도"}
              </button>
            </div>
          ) : (
            error && (
              <p
                role="alert"
                className="rounded-[11px] border border-[#F6C6C6] bg-[#FFF1F1] px-[15px] py-3 text-[13px] font-semibold text-[#C21414]"
              >
                {error.message}
              </p>
            )
          )}

          <button
            type="submit"
            disabled={loading || !isRequiredAgreed(agreements) || !isValidNickname(nickname)}
            className="w-full rounded-[11px] border-2 border-primary-dark bg-primary py-3.5 text-[15.5px] font-bold text-white shadow-tactile transition active:translate-y-0.5 active:shadow-tactile-active disabled:cursor-not-allowed disabled:border-[#D6D6DC] disabled:bg-[#E4E4E8] disabled:text-[#A0A0A8] disabled:shadow-none"
          >
            {loading ? "가입 중…" : "가입 완료"}
          </button>
        </form>
      </div>
    </main>
  );
}
