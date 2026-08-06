"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getMyInfo, changePassword } from "@/lib/authApi";
import { authErrorMessage } from "@/lib/authErrorMessages";
import { MyInfo } from "@/types/auth";

export default function ChangePasswordPage() {
  const authStatus = useRequireAuth();

  const [info, setInfo] = useState<MyInfo | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

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
    if (authStatus !== "authenticated") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트/재시도 시 조회 상태 초기화 후 페치
    load();
  }, [authStatus, load]);

  const field =
    "w-full rounded-[11px] border border-[#DDDDE3] px-3.5 py-3 text-[14.5px] outline-none";
  const primaryBtn = (enabled: boolean) =>
    `w-full rounded-[11px] border-2 py-3.5 text-[15.5px] font-bold ${
      enabled
        ? "border-primary-dark bg-primary text-white shadow-tactile"
        : "cursor-not-allowed border-[#D6D6DC] bg-[#E4E4E8] text-[#A0A0A8]"
    }`;
  const msgCls = (ok: boolean) =>
    `mt-3 rounded-[11px] border px-[15px] py-3 text-[13px] font-semibold ${
      ok
        ? "border-[#BFE6CE] bg-[#E8F7EF] text-[#059669]"
        : "border-[#F6C6C6] bg-[#FFF1F1] text-[#C21414]"
    }`;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    // LOCAL 계정만 변경 가능 (소셜/미조회 상태에서는 제출 차단)
    if (info?.provider !== "LOCAL") return;
    setMsg(null);
    if (!currentPassword) {
      setMsg({ ok: false, text: "현재 비밀번호를 입력해 주세요." });
      return;
    }
    if (
      newPassword.length < 8 ||
      newPassword.length > 20 ||
      !/^(?=.*[A-Za-z])(?=.*\d)\S+$/.test(newPassword)
    ) {
      setMsg({ ok: false, text: "비밀번호는 영문과 숫자를 포함해 8~20자, 공백 없이 입력해 주세요." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMsg({ ok: false, text: "새 비밀번호가 일치하지 않습니다." });
      return;
    }
    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMsg({ ok: true, text: "비밀번호가 변경되었습니다." });
    } catch (err) {
      setMsg({ ok: false, text: authErrorMessage(err, "비밀번호 변경에 실패했습니다.") });
    } finally {
      setSaving(false);
    }
  }

  if (authStatus !== "authenticated") {
    return (
      <main className="main-content flex items-center justify-center bg-neutral">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#E7E7EB] border-t-primary" />
      </main>
    );
  }

  return (
    <main className="main-content bg-neutral px-10 py-12">
      <div className="mx-auto w-full max-w-[480px]">
        <Link
          href="/mypage"
          className="mb-4 inline-block text-[13px] font-semibold text-[#8A8A92] hover:text-primary"
        >
          ← 마이페이지
        </Link>
        <div className="rounded-[18px] border border-[#EDEDF0] bg-white px-8 py-8 shadow-card">
          <h1 className="text-[22px] font-extrabold tracking-[-0.5px]">비밀번호 변경</h1>

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
          ) : info.provider !== "LOCAL" ? (
            <p className="mt-4 text-[14px] leading-relaxed text-[#7A7A82]">
              소셜 로그인 계정은 비밀번호를 변경할 수 없습니다.
            </p>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="mt-5 space-y-3">
                <div>
                  <label htmlFor="currentPassword" className="sr-only">
                    현재 비밀번호
                  </label>
                  <input
                    id="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="현재 비밀번호"
                    className={field}
                  />
                </div>
                <div>
                  <label htmlFor="newPassword" className="sr-only">
                    새 비밀번호
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="새 비밀번호 (영문+숫자 8~20자)"
                    className={field}
                  />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="sr-only">
                    새 비밀번호 확인
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="새 비밀번호 확인"
                    className={field}
                  />
                </div>
              </div>
              <button type="submit" disabled={saving} className={`mt-4 ${primaryBtn(!saving)}`}>
                {saving ? "변경 중…" : "비밀번호 변경"}
              </button>
              {msg && (
                <p role={msg.ok ? "status" : "alert"} className={msgCls(msg.ok)}>
                  {msg.text}
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
