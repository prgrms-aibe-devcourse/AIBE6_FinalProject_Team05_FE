"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { getMyInfo, changePassword } from "@/lib/authApi";
import { authErrorMessage } from "@/lib/authErrorMessages";
import { MyInfo } from "@/types/auth";

const field =
  "w-full rounded-[11px] border border-[#DDDDE3] px-3.5 py-3 text-[14.5px] outline-none";

// 비밀번호 표시 토글이 붙은 입력 — 세 칸이 모양과 동작이 같아 한 곳에 모았다.
// 표시 여부는 각 칸이 따로 들고 있어 한 칸을 열어도 나머지는 가려진 채로 남는다.
function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${field} pr-11`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? `${label} 숨기기` : `${label} 표시`}
        aria-pressed={visible}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9A9AA2] transition hover:text-[#4B4B52]"
      >
        {visible ? (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M3 3l18 18" />
            <path d="M10.6 10.6a3 3 0 004.2 4.2" />
            <path d="M9.9 5.2A10.6 10.6 0 0112 5c6.5 0 10 7 10 7a18 18 0 01-3.2 4.1M6.2 6.6A18 18 0 002 12s3.5 7 10 7c1.4 0 2.7-.3 3.9-.8" />
          </svg>
        ) : (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}

export default function ChangePasswordPage() {
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트/재시도 시 조회 상태 초기화 후 페치
    load();
  }, [load]);

  // 제출 전에도 확인 칸이 어긋난 것을 바로 알려준다(제출 시점 검사는 그대로 둔다).
  const passwordMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

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
      setMsg({
        ok: false,
        text: "비밀번호는 영문과 숫자를 포함해 8~20자, 공백 없이 입력해 주세요.",
      });
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

  return (
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
            <PasswordField
              id="currentPassword"
              label="현재 비밀번호"
              value={currentPassword}
              onChange={setCurrentPassword}
              placeholder="현재 비밀번호"
              autoComplete="current-password"
            />
            <PasswordField
              id="newPassword"
              label="새 비밀번호"
              value={newPassword}
              onChange={setNewPassword}
              placeholder="새 비밀번호 (영문+숫자 8~20자)"
              autoComplete="new-password"
            />
            <div>
              <PasswordField
                id="confirmPassword"
                label="새 비밀번호 확인"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="새 비밀번호 확인"
                autoComplete="new-password"
              />
              {passwordMismatch && (
                <p className="mt-[7px] text-[12px] font-semibold text-primary">
                  비밀번호가 일치하지 않습니다.
                </p>
              )}
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
  );
}
