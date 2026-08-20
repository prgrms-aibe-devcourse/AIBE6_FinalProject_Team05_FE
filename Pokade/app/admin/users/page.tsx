"use client";

import { useEffect, useState } from "react";
import AdminSidebar from "@/components/AdminSidebar";
import { fetchAdminUsers, forceWithdrawUser, suspendUser, unsuspendUser } from "@/lib/adminApi";
import { ApiError, PageResponse } from "@/lib/apiClient";
import { AdminUserResponse } from "@/types/adminUser";
import { UserRole, UserStatus } from "@/types/auth";
import { useUserStore } from "@/store/useUserStore";

const PAGE_SIZE = 20;

const STATUS_FILTERS: { label: string; value: UserStatus | null }[] = [
  { label: "전체", value: null },
  { label: "활성", value: "ACTIVE" },
  { label: "정지", value: "SUSPENDED" },
  { label: "미인증", value: "PENDING" },
  { label: "탈퇴 대기", value: "WITHDRAWAL_PENDING" },
  { label: "탈퇴", value: "DELETED" },
];

const ROLE_FILTERS: { label: string; value: UserRole | null }[] = [
  { label: "전체", value: null },
  { label: "일반", value: "USER" },
  { label: "운영자", value: "ADMIN" },
];

const STATUS_LABELS: Record<UserStatus, string> = {
  PENDING: "미인증",
  ACTIVE: "활성",
  WITHDRAWAL_PENDING: "탈퇴 대기",
  SUSPENDED: "정지",
  DELETED: "탈퇴",
};

const PROVIDER_LABELS: Record<AdminUserResponse["provider"], string> = {
  LOCAL: "이메일",
  GOOGLE: "구글",
  KAKAO: "카카오",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function AdminUsersPage() {
  const myUserId = useUserStore((s) => s.userId);

  const [status, setStatus] = useState<UserStatus | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState(""); // 실제 조회에 쓰는 값 — 제출 시에만 갱신한다
  const [page, setPage] = useState(1); // 1-based (UI) — API 호출 시 -1
  const [reloadKey, setReloadKey] = useState(0); // 제재 후 목록 갱신용
  const [actingId, setActingId] = useState<number | null>(null); // 처리 중인 행 — 중복 클릭 방지
  const [confirmWithdrawId, setConfirmWithdrawId] = useState<number | null>(null);
  const [actionError, setActionError] = useState("");

  // 조회 조건을 키로 묶어 결과와 함께 보관한다 — 조건이 바뀌면 옛 결과가 자동으로 무시되어
  // "에러 문구와 이전 목록이 동시에 보이는" 상태가 표현 불가능해진다.
  const [result, setResult] = useState<{
    key: string;
    page: PageResponse<AdminUserResponse> | null;
  } | null>(null);

  const requestKey = `${status ?? ""}|${role ?? ""}|${keyword}|${page}|${reloadKey}`;

  useEffect(() => {
    let cancelled = false;
    const key = requestKey;
    fetchAdminUsers({
      status: status ?? undefined,
      role: role ?? undefined,
      keyword: keyword || undefined,
      page: page - 1,
      size: PAGE_SIZE,
    })
      .then((data) => {
        if (!cancelled) setResult({ key, page: data });
      })
      .catch(() => {
        if (!cancelled) setResult({ key, page: null });
      });
    return () => {
      cancelled = true;
    };
  }, [status, role, keyword, page, reloadKey, requestKey]);

  const current = result?.key === requestKey ? result : null;
  const data = current?.page ?? null;
  const isError = current !== null && current.page === null;
  const isLoading = current === null;
  const users = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;

  function changeFilter(next: { status?: UserStatus | null; role?: UserRole | null }) {
    if (next.status !== undefined) setStatus(next.status);
    if (next.role !== undefined) setRole(next.role);
    setPage(1); // 조건이 바뀌면 첫 페이지로 — 3페이지에서 필터를 바꾸면 빈 화면이 된다
  }

  // 제재 공통 처리 — 성공하면 목록을 다시 불러 상태를 갱신한다
  async function runAction(userId: number, action: () => Promise<void>) {
    if (actingId !== null) return;
    setActionError("");
    setActingId(userId);
    try {
      await action();
      setConfirmWithdrawId(null);
      setReloadKey((k) => k + 1);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "처리에 실패했습니다.");
    } finally {
      setActingId(null);
    }
  }

  const chip = (active: boolean) =>
    `rounded-full px-[13px] py-1.5 text-[13px] font-bold ${
      active
        ? "border-2 border-primary-dark bg-primary text-white"
        : "border border-[#DDDDE3] text-[#6E6E76] hover:bg-[#F4F4F6]"
    }`;

  const rowBtn = (variant: "ghost" | "danger") =>
    `whitespace-nowrap rounded-[8px] px-2.5 py-1.5 text-[12.5px] font-bold disabled:opacity-40 ${
      variant === "danger"
        ? "border border-[#F0B4B4] text-[#C21414] hover:bg-[#FFF5F5]"
        : "border border-[#DDDDE3] text-[#6E6E76] hover:bg-[#F4F4F6]"
    }`;

  return (
    <main className="main-content flex bg-neutral">
      <AdminSidebar />

      <div className="min-w-0 flex-1 px-9 py-8">
        <h1 className="mb-1 mt-0 text-2xl font-extrabold tracking-[-0.5px]">회원 관리</h1>
        <p className="mb-[22px] text-[13.5px] text-[#8A8A92]">회원을 조회하고 정지·탈퇴를 처리함</p>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.label}
              onClick={() => changeFilter({ status: f.value })}
              className={chip(status === f.value)}
            >
              {f.label}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-[#DDDDE3]" />
          {ROLE_FILTERS.map((f) => (
            <button
              key={f.label}
              onClick={() => changeFilter({ role: f.value })}
              className={chip(role === f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setKeyword(keywordInput.trim());
            setPage(1);
          }}
          className="mb-5 flex gap-2"
        >
          <label htmlFor="keyword" className="sr-only">
            이메일 또는 닉네임 검색
          </label>
          <input
            id="keyword"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            placeholder="이메일 또는 닉네임"
            className="w-[260px] rounded-[10px] border border-[#DDDDE3] px-3 py-2 text-[14px] outline-none"
          />
          <button
            type="submit"
            className="rounded-[10px] border-2 border-primary-dark bg-primary px-4 py-2 text-[13.5px] font-bold text-white shadow-tactile"
          >
            검색
          </button>
          {keyword && (
            <button
              type="button"
              onClick={() => {
                setKeywordInput("");
                setKeyword("");
                setPage(1);
              }}
              className="rounded-[10px] border border-[#DDDDE3] px-4 py-2 text-[13.5px] font-bold text-[#6E6E76] hover:bg-[#F4F4F6]"
            >
              초기화
            </button>
          )}
        </form>

        {actionError && (
          <p
            role="alert"
            className="mb-4 rounded-[11px] border border-[#F6C6C6] bg-[#FFF1F1] px-[15px] py-3 text-[13px] font-semibold text-[#C21414]"
          >
            {actionError}
          </p>
        )}

        {isLoading && (
          <div className="flex h-[200px] items-center justify-center">
            <div role="status">
              <span
                aria-hidden="true"
                className="block h-8 w-8 animate-spin rounded-full border-[3px] border-[#E7E7EB] border-t-primary"
              />
              <span className="sr-only">회원 목록을 불러오는 중</span>
            </div>
          </div>
        )}

        {isError && (
          <p role="alert" className="py-10 text-center text-[13.5px] font-semibold text-[#C21414]">
            회원 목록을 불러오지 못했습니다.
          </p>
        )}

        {!isLoading && !isError && users.length === 0 && (
          <p className="py-10 text-center text-[13.5px] text-[#8A8A92]">
            조건에 맞는 회원이 없습니다.
          </p>
        )}

        {!isLoading && !isError && users.length > 0 && (
          <>
            <p className="mb-2 text-[12.5px] text-[#8A8A92]">
              전체 {data?.totalElements.toLocaleString("ko-KR")}명
            </p>
            <div className="overflow-x-auto rounded-[14px] border border-[#EDEDF0] bg-white shadow-card">
              <table className="w-full min-w-[880px] text-[13.5px]">
                <thead>
                  <tr className="border-b border-[#F0F0F0] text-left text-[#8A8A92]">
                    <th className="px-5 py-3 font-semibold">이메일</th>
                    <th className="px-5 py-3 font-semibold">닉네임</th>
                    <th className="px-5 py-3 font-semibold">가입 경로</th>
                    <th className="px-5 py-3 font-semibold">상태</th>
                    <th className="px-5 py-3 font-semibold">가입일</th>
                    <th className="px-5 py-3 font-semibold">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.userId} className="border-b border-[#F6F6F8] last:border-b-0">
                      <td className="px-5 py-3.5">{u.email}</td>
                      <td className="px-5 py-3.5 font-semibold">{u.nickname}</td>
                      <td className="px-5 py-3.5 text-[#6E6E76]">{PROVIDER_LABELS[u.provider]}</td>
                      <td className="px-5 py-3.5">{STATUS_LABELS[u.status]}</td>
                      <td className="px-5 py-3.5 text-[#6E6E76]">{formatDate(u.joinedAt)}</td>
                      <td className="px-5 py-3.5">
                        {u.userId === myUserId || u.role === "ADMIN" || u.status === "DELETED" ? (
                          // 본인·운영자·이미 탈퇴한 계정은 대상이 될 수 없다. 서버도 거부하지만
                          // 누를 수 있는 버튼을 두면 눌러도 소용없는 메뉴가 된다.
                          <span className="text-[12.5px] text-[#B4B4BC]">—</span>
                        ) : confirmWithdrawId === u.userId ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[12.5px] font-bold text-[#C21414]">
                              되돌릴 수 없습니다
                            </span>
                            <button
                              onClick={() => runAction(u.userId, () => forceWithdrawUser(u.userId))}
                              disabled={actingId !== null}
                              className={rowBtn("danger")}
                            >
                              {actingId === u.userId ? "처리 중…" : "확인"}
                            </button>
                            <button
                              onClick={() => setConfirmWithdrawId(null)}
                              disabled={actingId !== null}
                              className={rowBtn("ghost")}
                            >
                              취소
                            </button>
                          </div>
                        ) : (
                          // 첫 칸을 고정 폭으로 비워둬 강제 탈퇴가 행마다 같은 열에 오게 한다 —
                          // 되돌릴 수 없는 버튼이 행마다 움직이면 오클릭을 부른다.
                          <div className="grid w-fit grid-cols-[76px_auto] items-center gap-2">
                            <span>
                              {u.status === "ACTIVE" && (
                                <button
                                  onClick={() => runAction(u.userId, () => suspendUser(u.userId))}
                                  disabled={actingId !== null}
                                  className={rowBtn("ghost")}
                                >
                                  정지
                                </button>
                              )}
                              {u.status === "SUSPENDED" && (
                                <button
                                  onClick={() => runAction(u.userId, () => unsuspendUser(u.userId))}
                                  disabled={actingId !== null}
                                  className={rowBtn("ghost")}
                                >
                                  정지 해제
                                </button>
                              )}
                            </span>
                            <button
                              onClick={() => {
                                setActionError("");
                                setConfirmWithdrawId(u.userId);
                              }}
                              disabled={actingId !== null}
                              className={rowBtn("danger")}
                            >
                              강제 탈퇴
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="mt-5 flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-[9px] border border-[#DDDDE3] px-3 py-1.5 text-[13px] font-bold text-[#6E6E76] disabled:opacity-40"
                >
                  이전
                </button>
                <span className="text-[13px] text-[#6E6E76]">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-[9px] border border-[#DDDDE3] px-3 py-1.5 text-[13px] font-bold text-[#6E6E76] disabled:opacity-40"
                >
                  다음
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
