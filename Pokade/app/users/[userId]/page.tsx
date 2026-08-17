"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getPublicProfile } from "@/lib/profileApi";
import { ApiError } from "@/lib/apiClient";
import type { PublicProfile } from "@/types/profile";

type LoadState = "loading" | "ready" | "notfound" | "error";

// LocalDateTime 문자열을 YYYY. MM. DD. 로 표시
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function PublicProfilePage() {
  const params = useParams<{ userId: string }>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  const load = useCallback(async () => {
    const parsed = Number(params.userId);
    // 라우트 파라미터가 양의 정수가 아니면 요청을 보내지 않는다 (types/card.ts parseCardId와 동일 규칙).
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setLoadState("notfound");
      return;
    }
    setLoadState("loading");
    try {
      setProfile(await getPublicProfile(parsed));
      setLoadState("ready");
    } catch (e) {
      setLoadState(e instanceof ApiError && e.status === 404 ? "notfound" : "error");
    }
  }, [params.userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트/재시도 시 조회 상태 초기화 후 페치
    load();
  }, [load]);

  return (
    <main className="main-content bg-neutral px-10 py-12">
      <div className="mx-auto w-full max-w-[560px]">
        <h1 className="mb-6 text-[26px] font-extrabold tracking-[-0.6px]">프로필</h1>

        {loadState === "loading" && (
          <div className="flex h-[200px] items-center justify-center rounded-[18px] border border-[#EDEDF0] bg-white shadow-card">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#E7E7EB] border-t-primary" />
          </div>
        )}

        {loadState === "notfound" && (
          <div className="rounded-[18px] border border-[#EDEDF0] bg-white px-8 py-10 text-center shadow-card">
            <p className="text-[14px] font-semibold text-[#8A8A92]">존재하지 않는 사용자입니다.</p>
          </div>
        )}

        {loadState === "error" && (
          <div className="rounded-[18px] border border-[#F6C6C6] bg-[#FFF1F1] px-8 py-10 text-center shadow-card">
            <p role="alert" className="text-[14px] font-semibold text-[#C21414]">
              프로필을 불러오지 못했습니다.
            </p>
            <button
              onClick={load}
              className="mt-4 rounded-[11px] border-2 border-primary-dark bg-primary px-5 py-2.5 text-[14px] font-bold text-white shadow-tactile"
            >
              다시 시도
            </button>
          </div>
        )}

        {loadState === "ready" && profile && (
          <section className="rounded-[18px] border border-[#EDEDF0] bg-white px-8 py-7 shadow-card">
            <div className="flex items-center gap-4">
              <div className="flex h-[64px] w-[64px] items-center justify-center rounded-full bg-[#F2F2F5] text-[24px] font-extrabold text-[#B0B0B8]">
                {profile.nickname.slice(0, 1)}
              </div>
              <div>
                <p className="text-[19px] font-extrabold">{profile.nickname}</p>
                <p className="mt-1 text-[13px] text-[#8A8A92]">
                  {formatDate(profile.joinedAt)} 가입
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-[14px] bg-[#FAFAFB] px-5 py-4 text-center">
                <p className="text-[12.5px] text-[#8A8A92]">거래 수</p>
                <p className="mt-1 text-[20px] font-extrabold">
                  {profile.completedTradeCount.toLocaleString("ko-KR")}
                </p>
              </div>
              <div className="rounded-[14px] bg-[#FAFAFB] px-5 py-4 text-center">
                <p className="text-[12.5px] text-[#8A8A92]">판매 중 매물</p>
                <p className="mt-1 text-[20px] font-extrabold">
                  {profile.activeListingCount.toLocaleString("ko-KR")}
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
