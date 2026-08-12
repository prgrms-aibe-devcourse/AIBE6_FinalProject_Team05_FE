"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useUserStore } from "@/store/useUserStore";
import { getMyInfo, updateNickname, cancelWithdrawal } from "@/lib/authApi";
import { authErrorMessage } from "@/lib/authErrorMessages";
import { MyInfo } from "@/types/auth";

export default function MyPage() {
  const authStatus = useRequireAuth();
  const setNickname = useUserStore((s) => s.setNickname);

  const [info, setInfo] = useState<MyInfo | null>(null);
  const [loadError, setLoadError] = useState(false);

  const [editingNick, setEditingNick] = useState(false);
  const [nickInput, setNickInput] = useState("");
  const [nickSaving, setNickSaving] = useState(false);
  const [nickError, setNickError] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

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

  function startEdit() {
    setNickError(null);
    setNickInput(info?.nickname ?? "");
    setEditingNick(true);
  }

  function cancelEdit() {
    setEditingNick(false);
    setNickError(null);
  }

  async function saveNick() {
    if (nickSaving) return;
    setNickError(null);
    const next = nickInput.trim();
    if (next.length < 2 || next.length > 20) {
      setNickError("닉네임은 2자 이상 20자 이하로 입력해 주세요.");
      return;
    }
    if (next === info?.nickname) {
      setEditingNick(false);
      return;
    }
    setNickSaving(true);
    try {
      await updateNickname(next);
      setNickname(next);
      setInfo((prev) => (prev ? { ...prev, nickname: next } : prev));
      setEditingNick(false);
    } catch (e) {
      setNickError(authErrorMessage(e, "닉네임 변경에 실패했습니다."));
    } finally {
      setNickSaving(false);
    }
  }

  const inputCls = "rounded-[10px] border border-[#DDDDE3] px-3 py-2 text-[14px] outline-none";
  const smallBtn = (variant: "primary" | "ghost") =>
    `rounded-[9px] px-3 py-2 text-[13px] font-bold ${
      variant === "primary"
        ? "border-2 border-primary-dark bg-primary text-white shadow-tactile"
        : "border border-[#DDDDE3] text-[#6E6E76] hover:bg-[#F4F4F6]"
    }`;

  if (authStatus !== "authenticated") {
    return (
      <main className="main-content flex items-center justify-center bg-neutral">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#E7E7EB] border-t-primary" />
      </main>
    );
  }

  function daysLeft(withdrawalRequestedAt: string | null): number {
    if (!withdrawalRequestedAt) return 0;
    const deadline = new Date(withdrawalRequestedAt).getTime() + 7 * 24 * 60 * 60 * 1000;
    return Math.max(0, Math.ceil((deadline - new Date().getTime()) / (24 * 60 * 60 * 1000)));
  }

  async function handleCancelWithdrawal() {
    if (canceling) return;
    setCancelError(null);
    setCanceling(true);
    try {
      await cancelWithdrawal();
      await load(); // ACTIVE로 갱신 → 배너 사라짐
    } catch (e) {
      setCancelError(authErrorMessage(e, "탈퇴 철회에 실패했습니다."));
    } finally {
      setCanceling(false);
    }
  }

  const isLocal = info?.provider === "LOCAL";

  return (
    <main className="main-content bg-neutral px-10 py-12">
      <div className="mx-auto w-full max-w-[560px]">
        <h1 className="mb-6 text-[26px] font-extrabold tracking-[-0.6px]">마이페이지</h1>
        {info?.status === "WITHDRAWAL_PENDING" && (
          <div className="mb-5 rounded-[14px] border border-[#F6C6C6] bg-[#FFF1F1] px-6 py-5 shadow-card">
            <p className="text-[15px] font-extrabold text-[#C21414]">탈퇴 진행 중</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#8A4A4A]">
              삭제까지 <b>D-{daysLeft(info.withdrawalRequestedAt)}</b> 남았습니다. 지금 철회하면
              계정이 그대로 유지됩니다.
            </p>
            <button
              onClick={handleCancelWithdrawal}
              disabled={canceling}
              className="mt-3 rounded-[10px] border-2 border-primary-dark bg-primary px-5 py-2.5 text-[13.5px] font-bold text-white shadow-tactile disabled:opacity-60"
            >
              {canceling ? "처리 중…" : "탈퇴 철회하기"}
            </button>
            {cancelError && (
              <p role="alert" className="mt-2 text-[12.5px] font-semibold text-[#C21414]">
                {cancelError}
              </p>
            )}
          </div>
        )}

        {loadError ? (
          <div className="rounded-[18px] border border-[#EDEDF0] bg-white px-8 py-10 text-center shadow-card">
            <p role="alert" className="text-[14px] font-semibold text-[#C21414]">
              내 정보를 불러오지 못했습니다.
            </p>
            <button
              onClick={load}
              className="mt-4 rounded-[11px] border-2 border-primary-dark bg-primary px-5 py-2.5 text-[14px] font-bold text-white shadow-tactile"
            >
              다시 시도
            </button>
          </div>
        ) : !info ? (
          <div className="flex h-[200px] items-center justify-center rounded-[18px] border border-[#EDEDF0] bg-white shadow-card">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#E7E7EB] border-t-primary" />
          </div>
        ) : (
          <>
            <section className="rounded-[18px] border border-[#EDEDF0] bg-white px-8 py-7 shadow-card">
              <h2 className="text-[17px] font-extrabold">내 정보</h2>
              <div className="mt-4 space-y-4 text-[14px]">
                <div className="flex items-center justify-between">
                  <span className="text-[#8A8A92]">이메일</span>
                  <span className="font-semibold">{info.email}</span>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="shrink-0 text-[#8A8A92]">닉네임</span>
                    {editingNick ? (
                      <div className="flex flex-1 items-center justify-end gap-2">
                        <input
                          value={nickInput}
                          onChange={(e) => setNickInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.nativeEvent.isComposing) saveNick();
                            if (e.key === "Escape") cancelEdit();
                          }}
                          aria-label="닉네임"
                          autoComplete="off"
                          placeholder="2~20자"
                          className={`${inputCls} w-[160px]`}
                          autoFocus
                        />
                        <button
                          onClick={saveNick}
                          disabled={nickSaving}
                          className={smallBtn("primary")}
                        >
                          {nickSaving ? "저장 중…" : "저장"}
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={nickSaving}
                          className={smallBtn("ghost")}
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5">
                        <span className="font-semibold">{info.nickname}</span>
                        <button onClick={startEdit} className={smallBtn("ghost")}>
                          변경
                        </button>
                      </div>
                    )}
                  </div>
                  {nickError && (
                    <p
                      role="alert"
                      className="mt-2 text-right text-[12.5px] font-semibold text-[#C21414]"
                    >
                      {nickError}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#8A8A92]">포인트</span>
                  <span className="font-semibold">
                    {info.pointBalance.toLocaleString("ko-KR")} P
                  </span>
                </div>
              </div>
            </section>
            {info.status === "ACTIVE" && (
              <Link
                href="/mypage/withdrawal"
                className="mt-3 flex items-center justify-between rounded-[18px] border border-[#EDEDF0] bg-white px-8 py-6 shadow-card transition hover:bg-[#FAFAFB]"
              >
                <span className="text-[15px] font-bold text-[#C21414]">회원 탈퇴</span>
                <span aria-hidden="true" className="text-[18px] leading-none text-[#B0B0B8]">
                  ›
                </span>
              </Link>
            )}
            {isLocal && (
              <Link
                href="/mypage/password"
                className="mt-5 flex items-center justify-between rounded-[18px] border border-[#EDEDF0] bg-white px-8 py-6 shadow-card transition hover:bg-[#FAFAFB]"
              >
                <span className="text-[15px] font-bold">비밀번호 변경</span>
                <span aria-hidden="true" className="text-[18px] leading-none text-[#B0B0B8]">
                  ›
                </span>
              </Link>
            )}
          </>
        )}
      </div>
    </main>
  );
}
