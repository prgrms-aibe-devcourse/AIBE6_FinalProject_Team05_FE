"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import { oauth2Register } from "@/lib/authApi";

export default function SocialSignupPage() {
  const router = useRouter();
  const loginWithToken = useUserStore((s) => s.loginWithToken);
  const [ticket, setTicket] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket) return;
    setError(null);
    setLoading(true);
    try {
      const { accessToken } = await oauth2Register({ ticket, nickname, termsAgreed });
      await loginWithToken(accessToken);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "가입에 실패했습니다.");
      setLoading(false);
    }
  };

  if (!ticket) return null; // 티켓 파싱 전/실패 시 렌더 생략

  return (
    <div className="mx-auto mt-16 max-w-[400px] px-4">
      <h1 className="mb-6 text-xl font-bold">소셜 회원가입</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="닉네임 (2~20자)"
          minLength={2}
          maxLength={20}
          required
          className="rounded-[11px] border border-[#DADCE0] px-4 py-3 text-[15px] outline-none focus:border-primary"
        />
        <label className="flex items-center gap-2 text-[14px] text-[#3C4043]">
          <input
            type="checkbox"
            checked={termsAgreed}
            onChange={(e) => setTermsAgreed(e.target.checked)}
          />
          [필수] 이용약관에 동의합니다
        </label>
        {error && <p className="text-[13.5px] text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={loading || !termsAgreed || nickname.length < 2}
          className="rounded-[11px] bg-primary py-3.5 font-bold text-white transition active:translate-y-0.5 disabled:opacity-60"
        >
          {loading ? "가입 중..." : "가입 완료"}
        </button>
      </form>
    </div>
  );
}
