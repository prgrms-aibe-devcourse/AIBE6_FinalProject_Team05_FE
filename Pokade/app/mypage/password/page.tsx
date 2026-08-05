"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getMyInfo, changePassword } from "@/lib/authApi";
import { authErrorMessage } from "@/lib/authErrorMessages";
import { MyInfo } from "@/types/auth";

export default function ChangePasswordPage() {
  const authStatus = useRequireAuth();

  const [info, setInfo] = useState<MyInfo | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    let cancelled = false;
    getMyInfo()
      .then((me) => {
        if (!cancelled) setInfo(me);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authStatus]);

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

  async function handleSubmit() {
    if (saving) return;
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
    } catch (e) {
      setMsg({ ok: false, text: authErrorMessage(e, "비밀번호 변경에 실패했습니다.") });
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

          {info && info.provider !== "LOCAL" ? (
            <p className="mt-4 text-[14px] leading-relaxed text-[#7A7A82]">
              소셜 로그인 계정은 비밀번호를 변경할 수 없습니다.
            </p>
          ) : (
            <>
              <div className="mt-5 space-y-3">
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="현재 비밀번호"
                  className={field}
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="새 비밀번호 (영문+숫자 8~20자)"
                  className={field}
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="새 비밀번호 확인"
                  className={field}
                />
              </div>
              <button onClick={handleSubmit} disabled={saving} className={`mt-4 ${primaryBtn(!saving)}`}>
                {saving ? "변경 중…" : "비밀번호 변경"}
              </button>
              {msg && (
                <p role="alert" className={msgCls(msg.ok)}>
                  {msg.text}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
