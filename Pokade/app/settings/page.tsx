"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { useUserStore } from "@/store/useUserStore";
import { changeMarketingAgreement, getMyInfo, updateNickname } from "@/lib/authApi";
import { authErrorMessage } from "@/lib/authErrorMessages";
import { MyInfo } from "@/types/auth";
import { MyProfile } from "@/types/profile";
import { deleteProfileImage, uploadProfileImage, getMyProfile } from "@/lib/profileApi";
import { withCacheBuster } from "@/lib/profileImage";
import Avatar from "@/components/Avatar";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // BE 제한과 동일 — 초과분을 굳이 올려 413을 받지 않는다
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png"];

const PROVIDER_LABELS: Record<MyProfile["provider"], string> = {
  LOCAL: "이메일",
  GOOGLE: "구글",
  KAKAO: "카카오",
};

function providerLabel(provider: MyProfile["provider"]): string {
  return PROVIDER_LABELS[provider];
}

// LocalDateTime 문자열("2026-08-17T11:22:33")을 YYYY. MM. DD. 로 표시
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function SettingsPage() {
  const setNickname = useUserStore((s) => s.setNickname);
  const profileImageUrl = useUserStore((s) => s.profileImageUrl);
  const setProfileImageUrl = useUserStore((s) => s.setProfileImageUrl);

  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [info, setInfo] = useState<MyInfo | null>(null);
  const [loadError, setLoadError] = useState(false);

  const [editingNick, setEditingNick] = useState(false);
  const [nickInput, setNickInput] = useState("");
  const [nickSaving, setNickSaving] = useState(false);
  const [nickError, setNickError] = useState<string | null>(null);
  const [imageSaving, setImageSaving] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [marketingSaving, setMarketingSaving] = useState(false);
  const [marketingError, setMarketingError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoadError(false);
    setInfo(null);
    setProfile(null);
    try {
      const me = await getMyInfo();
      setInfo(me);
      setProfileImageUrl(me.profileImageUrl);
    } catch {
      setLoadError(true);
      return; // 기본 정보가 없으면 에러 화면이므로 상세는 요청하지 않는다
    }
    // 상세는 부가 정보라 실패해도 렌더를 막지 않는다 (해당 줄만 비워둠).
    try {
      setProfile(await getMyProfile());
    } catch {
      setProfile(null);
    }
  }, [setProfileImageUrl]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트/재시도 시 조회 상태 초기화 후 페치
    load();
  }, [load]);

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

  async function handleImageSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일을 다시 골라도 change가 발생하도록 비운다
    if (!file) return;

    setImageError(null);
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageError("jpg 또는 png 이미지만 올릴 수 있습니다.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError("5MB 이하 이미지만 올릴 수 있습니다.");
      return;
    }

    setImageSaving(true);
    try {
      await uploadProfileImage(file);
      const me = await getMyInfo();
      setInfo(me);
      // 경로는 서버가 준 값을 그대로 쓰고 버전만 덧붙인다 — 경로 조립은 BE 몫이다
      setProfileImageUrl(me.profileImageUrl ? withCacheBuster(me.profileImageUrl) : null);
    } catch (err) {
      setImageError(authErrorMessage(err, "이미지 업로드에 실패했습니다."));
    } finally {
      setImageSaving(false);
    }
  }

  async function handleImageDelete() {
    if (imageSaving) return;
    setImageError(null);
    setImageSaving(true);
    try {
      await deleteProfileImage();
      setProfileImageUrl(null);
      setInfo((prev) => (prev ? { ...prev, profileImageUrl: null } : prev));
    } catch (err) {
      setImageError(authErrorMessage(err, "이미지 삭제에 실패했습니다."));
    } finally {
      setImageSaving(false);
    }
  }

  // 마케팅 수신 동의변경, 서버는 철회도 새 이력 행으로 남기므로 낙관적 갱신 대신 응답 후 반영한다.
  async function handleMarketingToggle(next: boolean) {
    if (marketingSaving) return;
    setMarketingError(null);
    setMarketingSaving(true);
    try {
      await changeMarketingAgreement(next);
      setProfile((prev) => (prev ? { ...prev, marketingAgreed: next } : prev));
    } catch (e) {
      setMarketingError(authErrorMessage(e, "설정 변경에 실패했습니다."));
    } finally {
      setMarketingSaving(false);
    }
  }

  const inputCls = "rounded-[10px] border border-[#DDDDE3] px-3 py-2 text-[14px] outline-none";
  const smallBtn = (variant: "primary" | "ghost") =>
    `rounded-[9px] px-3 py-2 text-[13px] font-bold ${
      variant === "primary"
        ? "border-2 border-primary-dark bg-primary text-white shadow-tactile"
        : "border border-[#DDDDE3] text-[#6E6E76] hover:bg-[#F4F4F6]"
    }`;

  if (loadError) {
    return (
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
    );
  }

  if (!info) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-[18px] border border-[#EDEDF0] bg-white shadow-card">
        <div role="status">
          <span
            aria-hidden="true"
            className="block h-8 w-8 animate-spin rounded-full border-[3px] border-[#E7E7EB] border-t-primary"
          />
          <span className="sr-only">내 정보를 불러오는 중</span>
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-[18px] border border-[#EDEDF0] bg-white px-8 py-7 shadow-card">
      <h1 className="text-[17px] font-extrabold">내 정보</h1>
      <div className="mt-5 flex items-center gap-4">
        <Avatar
          path={profileImageUrl}
          nickname={info.nickname}
          size={72}
          className="bg-[#F2F2F5] text-[26px] font-extrabold text-[#B0B0B8]"
        />
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={imageSaving}
              className={smallBtn("primary")}
            >
              {imageSaving ? "처리 중…" : profileImageUrl ? "사진 변경" : "사진 등록"}
            </button>
            {profileImageUrl && (
              <button
                onClick={handleImageDelete}
                disabled={imageSaving}
                className={smallBtn("ghost")}
              >
                삭제
              </button>
            )}
          </div>
          <p className="text-[12px] text-[#8A8A92]">jpg·png, 5MB 이하</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png"
          onChange={handleImageSelect}
          className="hidden"
          aria-label="프로필 이미지 선택"
        />
      </div>
      {imageError && (
        <p role="alert" className="mt-2 text-[12.5px] font-semibold text-[#C21414]">
          {imageError}
        </p>
      )}
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
                <button onClick={saveNick} disabled={nickSaving} className={smallBtn("primary")}>
                  {nickSaving ? "저장 중…" : "저장"}
                </button>
                <button onClick={cancelEdit} disabled={nickSaving} className={smallBtn("ghost")}>
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
            <p role="alert" className="mt-2 text-right text-[12.5px] font-semibold text-[#C21414]">
              {nickError}
            </p>
          )}
        </div>

        {profile && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-[#8A8A92]">연락처</span>
              <span className="font-semibold">{profile.phoneNumber ?? "등록되지 않음"}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[#8A8A92]">가입 경로</span>
              <span className="font-semibold">
                {profile.socialLinked ? providerLabel(profile.provider) : "이메일"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[#8A8A92]">가입일</span>
              <span className="font-semibold">{formatDate(profile.joinedAt)}</span>
            </div>
          </>
        )}

        <div className="flex items-center justify-between">
          <span className="text-[#8A8A92]">포인트</span>
          <span className="font-semibold">{info.pointBalance.toLocaleString("ko-KR")} P</span>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[#F0F0F0] pt-4">
          <div className="min-w-0">
            <p className="font-semibold">마케팅 정보 수신</p>
            <p className="mt-0.5 text-[12.5px] text-[#8A8A92]">
              혜택·이벤트 소식을 이메일로 받습니다. 언제든 해제할 수 있습니다.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={profile?.marketingAgreed ?? false}
            aria-label="마케팅 정보 수신"
            disabled={marketingSaving || !profile}
            onClick={() => handleMarketingToggle(!profile?.marketingAgreed)}
            className={`relative h-[26px] w-[46px] flex-shrink-0 rounded-full transition disabled:opacity-50 ${
              profile?.marketingAgreed ? "bg-primary" : "bg-[#D6D6DC]"
            }`}
          >
            <span
              aria-hidden="true"
              className={`absolute top-[3px] h-5 w-5 rounded-full bg-white transition-all ${
                profile?.marketingAgreed ? "left-[23px]" : "left-[3px]"
              }`}
            />
          </button>
        </div>
        {marketingError && (
          <p role="alert" className="text-right text-[12.5px] font-semibold text-[#C21414]">
            {marketingError}
          </p>
        )}
      </div>
    </section>
  );
}
