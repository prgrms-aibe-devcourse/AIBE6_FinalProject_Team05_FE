"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getMyInfo, cancelWithdrawal } from "@/lib/authApi";
import { authErrorMessage } from "@/lib/authErrorMessages";
import { MyInfo } from "@/types/auth";
import MyTradesSection from "./MyTradesSection";

export default function MyPage() {
  const authStatus = useRequireAuth();

  const [info, setInfo] = useState<MyInfo | null>(null);
  const [loadError, setLoadError] = useState(false);
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

  return (
    <main className="main-content bg-neutral px-10 py-12">
      <div className="mx-auto w-full max-w-[560px]">
        <h1 className="mb-6 text-[26px] font-extrabold tracking-[-0.6px]">마이페이지</h1>
        {info?.status === "WITHDRAWAL_PENDING" && (
          <div className="mb-5 rounded-[14px] border border-[#F6C6C6] bg-[#FFF1F1] px-6 py-5 shadow-card">
            <p className="text-[15px] font-extrabold text-[#C21414]">탈퇴 진행 중</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#8A4A4A]">
              {info.withdrawalRequestedAt ? (
                daysLeft(info.withdrawalRequestedAt) > 0 ? (
                  <>
                    삭제까지 <b>D-{daysLeft(info.withdrawalRequestedAt)}</b> 남았습니다. 지금
                    철회하면 계정이 그대로 유지됩니다.
                  </>
                ) : (
                  <>곧 탈퇴 처리됩니다. 지금 철회하면 계정이 그대로 유지됩니다.</>
                )
              ) : (
                <>탈퇴가 진행 중입니다. 지금 철회하면 계정이 그대로 유지됩니다.</>
              )}
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
            <MyTradesSection />

            <Link
              href="/mypage/inquiries"
              className="mt-3 flex items-center justify-between rounded-[18px] border border-[#EDEDF0] bg-white px-8 py-6 shadow-card transition hover:bg-[#FAFAFB]"
            >
              <span className="text-[15px] font-bold">1:1 문의 내역</span>
              <span aria-hidden="true" className="text-[18px] leading-none text-[#B0B0B8]">
                ›
              </span>
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
