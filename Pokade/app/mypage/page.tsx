"use client";

import { useEffect, useState } from "react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useUserStore } from "@/store/useUserStore";
import { getMyInfo, updateNickname, changePassword } from "@/lib/authApi";
import { authErrorMessage } from "@/lib/authErrorMessages";
import { MyInfo } from "@/types/auth";

export default function MyPage() {
  const authStatus = useRequireAuth();
  const setNickname = useUserStore((s) => s.setNickname);

  const [info, setInfo] = useState<MyInfo | null>(null);

  const [nickname, setNicknameInput] = useState("");
  const [nickSaving, setNickSaving] = useState(false);
  const [nickMsg, setNickMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    let cancelled = false;
    getMyInfo()
      .then((me) => {
        if (cancelled) return;
        setInfo(me);
        setNicknameInput(me.nickname);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  const field =
    "w-full rounded-[11px] border border-[#DDDDE3] px-3.5 py-3 text-[14.5px] outline-none";
  const primaryBtn = (enabled: boolean) =>
    `rounded-[11px] border-2 px-5 py-3 text-[14.5px] font-bold ${
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

  async function handleNickname() {
    if (nickSaving) return;
    setNickMsg(null);
    const next = nickname.trim();
    if (next.length < 2 || next.length > 20) {
      setNickMsg({ ok: false, text: "닉네임은 2자 이상 20자 이하로 입력해 주세요." });
      return;
    }
    if (next === info?.nickname) {
      setNickMsg({ ok: false, text: "현재 닉네임과 동일합니다." });
      return;
    }
    setNickSaving(true);
    try {
      await updateNickname(next);
      setNickname(next);
      setInfo((prev) => (prev ? { ...prev, nickname: next } : prev));
      setNickMsg({ ok: true, text: "닉네임이 변경되었습니다." });
    } catch (e) {
      setNickMsg({ ok: false, text: authErrorMessage(e, "닉네임 변경에 실패했습니다.") });
    } finally {
      setNickSaving(false);
    }
  }

  async function handlePassword() {
    if (pwSaving) return;
    setPwMsg(null);
    if (!currentPassword) {
      setPwMsg({ ok: false, text: "현재 비밀번호를 입력해 주세요." });
      return;
    }
    if (
      newPassword.length < 8 ||
      newPassword.length > 20 ||
      !/^(?=.*[A-Za-z])(?=.*\d)\S+$/.test(newPassword)
    ) {
      setPwMsg({
        ok: false,
        text: "비밀번호는 영문과 숫자를 포함해 8~20자, 공백 없이 입력해 주세요.",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ ok: false, text: "새 비밀번호가 일치하지 않습니다." });
      return;
    }
    setPwSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPwMsg({ ok: true, text: "비밀번호가 변경되었습니다." });
    } catch (e) {
      setPwMsg({ ok: false, text: authErrorMessage(e, "비밀번호 변경에 실패했습니다.") });
    } finally {
      setPwSaving(false);
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
      <div className="mx-auto w-full max-w-[560px]">
        <h1 className="mb-6 text-[26px] font-extrabold tracking-[-0.6px]">마이페이지</h1>

        <section className="mb-5 rounded-[18px] border border-[#EDEDF0] bg-white px-8 py-7 shadow-card">
          <h2 className="text-[17px] font-extrabold">내 정보</h2>
          <dl className="mt-4 space-y-2.5 text-[14px]">
            <div className="flex justify-between">
              <dt className="text-[#8A8A92]">이메일</dt>
              <dd className="font-semibold">{info?.email ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#8A8A92]">닉네임</dt>
              <dd className="font-semibold">{info?.nickname ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#8A8A92]">포인트</dt>
              <dd className="font-semibold">
                {info ? info.pointBalance.toLocaleString("ko-KR") : "—"} P
              </dd>
            </div>
          </dl>
        </section>

        <section className="mb-5 rounded-[18px] border border-[#EDEDF0] bg-white px-8 py-7 shadow-card">
          <h2 className="text-[17px] font-extrabold">닉네임 변경</h2>
          <p className="mt-1.5 text-[12.5px] text-[#9A9AA2]">
            닉네임은 마지막 변경 후 30일이 지나야 다시 변경할 수 있습니다.
          </p>
          <div className="mt-4 flex gap-2">
            <input
              value={nickname}
              onChange={(e) => setNicknameInput(e.target.value)}
              placeholder="2~20자"
              className={field}
            />
            <button
              onClick={handleNickname}
              disabled={nickSaving}
              className={primaryBtn(!nickSaving)}
            >
              {nickSaving ? "저장 중…" : "변경"}
            </button>
          </div>
          {nickMsg && (
            <p role="alert" className={msgCls(nickMsg.ok)}>
              {nickMsg.text}
            </p>
          )}
        </section>

        <section className="rounded-[18px] border border-[#EDEDF0] bg-white px-8 py-7 shadow-card">
          <h2 className="text-[17px] font-extrabold">비밀번호 변경</h2>
          <p className="mt-1.5 text-[12.5px] text-[#9A9AA2]">
            소셜 로그인 계정은 비밀번호를 변경할 수 없습니다.
          </p>
          <div className="mt-4 space-y-3">
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
          <button
            onClick={handlePassword}
            disabled={pwSaving}
            className={`mt-4 ${primaryBtn(!pwSaving)}`}
          >
            {pwSaving ? "변경 중…" : "비밀번호 변경"}
          </button>
          {pwMsg && (
            <p role="alert" className={msgCls(pwMsg.ok)}>
              {pwMsg.text}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
