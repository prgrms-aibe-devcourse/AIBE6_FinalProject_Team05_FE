"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import CardImage from "@/components/CardImage";
import Avatar from "@/components/Avatar";
import { SearchBar } from "@/components/CardSearchBar";
import { useEscapeAndScrollLock } from "@/hooks/useEscapeAndScrollLock";
import { useMinuteTick } from "@/hooks/useMinuteTick";
import {
  notifStyle,
  formatNotifTime,
  notificationHref,
  MARK_ALL_READ_BUTTON_CLASS,
} from "@/lib/notificationDisplay";
import { NotificationResponse } from "@/types/notification";
import { useUserStore } from "@/store/useUserStore";
import { selectUnreadCount, useNotificationStore } from "@/store/useNotificationStore";

const NAV: { label: string; href: string }[] = [
  { label: "마켓", href: "/search" },
  { label: "시세 랭킹", href: "/ranking" },
  { label: "AI 등급진단", href: "/ai-diagnosis" },
  { label: "상품 등록", href: "/listings/new" },
];

// 헤더에서 동시에 하나만 열릴 수 있는 오버레이 — 알림/프로필 드롭다운과 모바일 메뉴 드로어가
// 각자 독립된 state였을 때, 하나가 열린 채로 다른 트리거를 누르면 그 백드롭이 클릭을 가로채
// "열려던 것 대신 지금 열린 것만 닫히는" 문제가 있었다. 하나의 값으로 합쳐 상호배타를 타입
// 레벨에서 보장한다 — Header(단, LoggedInRight에 props로 전달)가 유일하게 소유한다.
type HeaderPanel = "notif" | "profile" | "menu" | null;

// href가 없으면 아직 화면이 없는 메뉴다. 설정은 /settings 신설 후 연결한다.
const PROFILE_MENU: { label: string; href?: string }[] = [
  { label: "마이페이지", href: "/mypage" },
  { label: "내 포트폴리오", href: "/portfolio" },
  { label: "내 상품 관리", href: "/listings/me" },
  { label: "관심 목록", href: "/watchlist" },
  { label: "포인트 충전", href: "/mypage/points/charge" },
  { label: "설정", href: "/settings" },
];

// 관리자에게만 붙는 항목. role이 확정되기 전에는 null이라 자연히 숨겨진다.
const ADMIN_MENU: { label: string; href?: string }[] = [
  { label: "관리자 콘솔", href: "/admin/dashboard" },
];

function LoggedInRight({
  open,
  setOpen,
}: {
  open: HeaderPanel;
  setOpen: (value: HeaderPanel | ((prev: HeaderPanel) => HeaderPanel)) => void;
}) {
  const notifId = useId();
  const profileId = useId();
  const router = useRouter();
  const nickname = useUserStore((s) => s.nickname);
  const profileImageUrl = useUserStore((s) => s.profileImageUrl);
  const email = useUserStore((s) => s.email);
  const role = useUserStore((s) => s.role);
  const pointBalance = useUserStore((s) => s.pointBalance);
  const logout = useUserStore((s) => s.logout);

  // 알림 조회+30초 폴링은 useNotificationStore가 앱 전체에서 유일하게 소유한다.
  // Header는 로그인 상태인 동안(마운트~언마운트) 그 생명주기를 관리하는 역할 — 마운트 시
  // start()(멱등)로 폴링을 켜고, 로그아웃으로 언마운트되면 stop()으로 정리한다.
  const notifications = useNotificationStore((s) => s.notifications);
  const loadState = useNotificationStore((s) => s.loadState);
  const errorMessage = useNotificationStore((s) => s.errorMessage);
  const startNotifications = useNotificationStore((s) => s.start);
  const stopNotifications = useNotificationStore((s) => s.stop);
  const retryNotifications = useNotificationStore((s) => s.retry);
  const markOneRead = useNotificationStore((s) => s.markOneRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);

  // 드롭다운이 열린 동안 "N분 전" 상대시간이 굳지 않도록 1분마다 리렌더한다(#238).
  // 30초 폴링이 목록을 교체하며 갱신하지만 그 사이 구간(최대 30초)엔 굳고, SSE 모드에선
  // 새 알림이 오기 전까지 갱신 트리거가 없다. 드롭다운이 닫혀 있으면(open !== "notif")
  // 상대시간이 화면에 없으므로 타이머를 걸지 않아 불필요한 리렌더를 피한다.
  useMinuteTick(open === "notif");

  // 목적지 규칙은 /app/notifications/page.tsx와 공유한다(lib/notificationDisplay의
  // notificationHref) — 읽음 여부와 무관하게 항상 이동하고, 드롭다운은 페이지 전환 후
  // 열려있지 않도록 닫는다. 갈 곳이 없는 알림(href가 null)은 읽음 처리만 하고 드롭다운을
  // 그대로 둔다.
  const handleNotificationClick = (n: NotificationResponse) => {
    markOneRead(n);
    const href = notificationHref(n);
    if (href != null) {
      setOpen(null);
      router.push(href);
    }
  };

  useEffect(() => {
    startNotifications();
    return () => stopNotifications();
  }, [startNotifications, stopNotifications]);

  // 알림 드롭다운을 열 때, 직전 조회가 에러였다면 폴링 주기를 기다리지 않고 바로 재시도한다.
  const toggle = (which: "notif" | "profile") =>
    setOpen((o) => {
      const next = o === which ? null : which;
      if (next === "notif" && loadState === "error") retryNotifications();
      return next;
    });

  // 새 알림이 SSE로 도착한 순간에만 벨을 한 번 흔든다(#235). key가 바뀌면 svg가 리마운트돼
  // CSS 애니메이션이 다시 재생된다. 0(=도착 이력 없음)일 때는 클래스를 붙이지 않아, 안 읽은
  // 알림을 둔 채 페이지를 열어도 흔들리지 않는다.
  // (bell-shake는 Tailwind 유틸리티가 아니라 globals.css의 커스텀 클래스라 motion-safe: 접두사를
  //  붙일 수 없다 — prefers-reduced-motion 처리는 그 클래스 정의 자체가 미디어쿼리 안에 있다.)
  const arrivalSeq = useNotificationStore((s) => s.arrivalSeq);

  const unreadCount = useNotificationStore(selectUnreadCount);
  const notifLabel = unreadCount > 0 ? `안 읽은 알림 ${unreadCount}개` : "알림";

  return (
    <div className="relative flex items-center gap-4">
      <SearchBar width="hidden w-60 md:block" />
      <button
        onClick={() => toggle("notif")}
        aria-label={notifLabel}
        aria-expanded={open === "notif"}
        aria-controls={notifId}
        className="relative flex h-10 w-10 items-center justify-center rounded-[9px] bg-neutral transition-colors hover:bg-[#ECECEF]"
      >
        <svg
          key={arrivalSeq}
          className={arrivalSeq > 0 ? "bell-shake" : undefined}
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#4B4B52"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 01-3.4 0" />
        </svg>
        {/* 안 읽은 개수 배지(#238) — 예전에는 7px 점이라 "뭔가 있다"까지만 알 수 있고 몇 건인지는
            aria-label에만 있었다(시각 사용자에게만 정보가 빠져 있던 셈). 숫자를 직접 띄우되 두 자리
            이상은 배지가 벨을 덮어버려 "9+"로 줄인다.
            배경이 primary가 아니라 primary-dark인 이유: 10px 흰 글씨는 WCAG 기준상 일반 텍스트라
            4.5:1이 필요한데 primary(#EE1515)는 4.43:1로 아슬하게 미달이고 primary-dark(#B80F0F)는
            6.75:1이다. 정확한 개수는 계속 버튼 aria-label이 읽어주므로(9+로 줄지 않는다) 배지 자체는
            aria-hidden으로 두어 스크린리더가 같은 정보를 두 번 읽지 않게 한다. */}
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-primary-dark px-1 text-[10px] font-bold leading-none text-white"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      <button
        onClick={() => toggle("profile")}
        aria-label="프로필"
        aria-expanded={open === "profile"}
        aria-controls={profileId}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-[14px] font-bold text-white"
      >
        <Avatar path={profileImageUrl} nickname={nickname} size={40} />
      </button>

      {/* 알림/프로필 패널(및 백드롭)은 <header>(sticky+z-50)가 만드는 스태킹 컨텍스트에 갇히면
          같은 z-index라도 header 바깥의 다른 오버레이(예: /search 필터 바텀시트)와 정확히 비교되지
          않는다. document.body로 Portal해서 header 스태킹 컨텍스트 밖으로 완전히 빼낸다 - 이때
          absolute 위치(right-*, top-*)가 기존과 동일하게 보이도록, header와 같은 좌우 패딩(px-4
          sm:px-10)을 가진 얇은 fixed 래퍼를 여기서도 그대로 재현한다(top-52px였던 값은 이 래퍼의
          top이 header 상단과 같아졌으므로 header 높이 그대로인 top-16으로 치환). */}
      {(open === "notif" || open === "profile") &&
        createPortal(
          <div
            onClick={() => setOpen(null)}
            aria-hidden="true"
            className="fixed inset-x-0 bottom-0 top-16 z-[80]"
          />,
          document.body,
        )}

      {open === "notif" &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-0 top-0 z-[90] px-4 sm:px-10">
            {/* dropdown-pop-in: 조건부 마운트라 transition으로는 잡히지 않아 globals.css의
                keyframes를 한 번 재생한다(#238). 벨(우상단)에서 자라나는 느낌이 되도록
                transform-origin을 그쪽에 두었고, prefers-reduced-motion은 클래스 정의 자체가
                미디어쿼리 안에 있어 자동으로 꺼진다(bell-shake와 같은 방식).
                프로필 드롭다운에는 일부러 붙이지 않았다 — 같은 파일이지만 임현호 소유 영역이라
                알림 쪽만 손댄다. */}
            <div
              id={notifId}
              aria-label="알림 목록"
              className="dropdown-pop-in pointer-events-auto absolute right-[44px] top-16 w-[344px] overflow-hidden rounded-[14px] border border-[#EDEDF0] bg-white shadow-[0_14px_38px_rgba(20,26,52,0.18)]"
            >
              <div className="flex min-h-[52px] items-center justify-between border-b border-[#F0F0F0] px-4 py-2">
                <span className="text-[14.5px] font-extrabold">알림</span>
                {/* 안읽음이 없으면 숨긴다(#238) — store의 markAllRead도 안읽음 0건이면 그대로
                    return하므로, 예전에는 눌러도 아무 일이 없는 버튼이 늘 떠 있었다.
                    전체 알림 페이지와 같은 기준(selectUnreadCount)을 쓴다.
                    버튼이 사라져도 헤더 높이가 흔들리지 않도록 min-h를 준다. */}
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className={`cursor-pointer ${MARK_ALL_READ_BUTTON_CLASS}`}
                  >
                    모두 읽음 처리
                  </button>
                )}
              </div>
              {/* 340px 고정이던 시절엔 2줄 메시지(행 83px) 기준 4건밖에 안 보여, 피드가 들고 있는
                  20건 중 대부분이 스크롤 뒤에 숨었다(#238). 뷰포트에 맞춰 늘리되 상한을 둔다 —
                  세로가 긴 모니터에서 화면을 꽉 채우는 드롭다운은 오히려 부담스럽다.
                  vh가 아니라 dvh를 쓰는 이유: 모바일 브라우저의 주소창이 접히고 펴질 때 vh는
                  갱신되지 않아, 주소창이 펼쳐진 상태에서 목록이 화면 밖으로 밀려난다.
                  단순 비율(예: 60dvh) 대신 100dvh에서 200px을 빼는 이유: 목록 위아래로 패널
                  자체가 차지하는 높이(상단 여백 58 + 헤더 48 + 푸터 46 ≒ 152)가 고정이라,
                  비율만 쓰면 화면이 아주 낮을 때(400px대) 그 고정분 때문에 아래가 잘린다.
                  빼고 시작하면 어떤 높이에서도 최소 37px 여백이 남는다. */}
              <div className="max-h-[min(calc(100dvh-200px),520px)] overflow-y-auto">
                {loadState === "loading" && (
                  <div className="px-4 py-8 text-center text-[13px] text-[#9A9AA2]">
                    불러오는 중...
                  </div>
                )}
                {loadState === "error" && (
                  <div
                    role="alert"
                    className="mx-4 my-3 rounded-[12px] border border-[#F6C6C6] bg-[#FFF1F1] px-4 py-3 text-center text-[13px] font-semibold text-[#C21414]"
                  >
                    {errorMessage}
                  </div>
                )}
                {loadState === "ready" && notifications.length === 0 && (
                  <div className="px-4 py-8 text-center text-[13px] text-[#9A9AA2]">
                    새 알림이 없습니다.
                  </div>
                )}
                {loadState === "ready" &&
                  notifications.length > 0 &&
                  notifications.map((n) => {
                    const style = notifStyle(n.type);
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => handleNotificationClick(n)}
                        className={`relative flex w-full cursor-pointer gap-[11px] border-b border-[#F5F5F7] px-4 py-[13px] text-left hover:bg-[#FAFAFB] ${!n.isRead ? "bg-[#FFF1F1]" : ""}`}
                      >
                        {/* 안읽음 표시(#238) — 예전에는 배경 틴트(#FFF7F7)와 7px 점뿐이었는데,
                            틴트는 흰 배경과 명도 대비 1.06:1이라 옆에 나란히 놓기 전엔 구분이
                            안 되고 점은 너무 작아 목록을 훑을 때 놓치기 쉬웠다. 행 왼쪽 끝의
                            3px 바로 바꾸면 세로로 이어져 스캔이 쉽고, primary는 흰 배경 대비
                            4:1 이상이라 그래픽 요소 기준(3:1)을 넘긴다. 틴트는 보조 단서로만
                            남기되 프로젝트에서 이미 쓰는 #FFF1F1로 살짝 올렸다. */}
                        {!n.isRead && (
                          <span
                            aria-hidden="true"
                            className="absolute inset-y-0 left-0 w-[3px] bg-primary"
                          />
                        )}
                        {/* /app/notifications/page.tsx와 동일한 정책 — cardImageUrl 있으면 카드
                            썸네일, 없으면(또는 조회 실패) 기존 타입 아이콘. 좁은 드롭다운이라도
                            34px 그대로 유지(전체 목록과 다른 크기 분기를 또 만들지 않는다).
                            썸네일이 있어도 종류를 구분할 수 있도록, 우하단에 타입 아이콘을 작은
                            원형 배지로 겹쳐 그린다(overflow-hidden 밖이라 안 잘림). */}
                        {n.cardImageUrl ? (
                          <div className="relative h-[34px] w-[34px] flex-shrink-0">
                            <div className="h-full w-full overflow-hidden rounded-[9px] bg-[#F2F2F5]">
                              {/* 실제 카드 이미지를 대조해 보면 일러스트 프레임이 카드 세로 기준
                                  대략 5~51% 지점에 있다 — object-top으로 상단부터 잘라낸 뒤 그
                                  프레임만 꽉 채우도록 scale+origin으로 확대한다. */}
                              <CardImage
                                src={n.cardImageUrl}
                                alt=""
                                rounded="rounded-[9px]"
                                className="origin-[50%_19%] scale-150 object-top"
                              />
                            </div>
                            <div
                              className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white"
                              style={{ background: style.tint }}
                            >
                              {notifStyle(n.type, 10).icon}
                            </div>
                          </div>
                        ) : (
                          <div
                            className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[9px]"
                            style={{ background: style.tint }}
                          >
                            {style.icon}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div
                            className={`text-[13px] leading-[1.4] text-ink ${!n.isRead ? "font-bold" : "font-semibold"}`}
                          >
                            {n.message}
                          </div>
                          <div className="mt-[3px] text-[11px] text-[#B0B0B8]">
                            {formatNotifTime(n.createdAt)}
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>
              <Link
                href="/notifications"
                onClick={() => setOpen(null)}
                className="block border-t border-[#F0F0F0] px-4 py-[13px] text-center text-[13px] font-bold text-secondary hover:bg-[#FAFAFB]"
              >
                전체 알림 보기
              </Link>
            </div>
          </div>,
          document.body,
        )}

      {open === "profile" &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-0 top-0 z-[90] px-4 sm:px-10">
            <div
              id={profileId}
              aria-label="프로필 메뉴"
              className="pointer-events-auto absolute right-0 top-16 w-[260px] overflow-hidden rounded-[14px] border border-[#EDEDF0] bg-white shadow-[0_14px_38px_rgba(20,26,52,0.18)]"
            >
              <div className="flex items-center gap-3 px-4 py-[18px]">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-base font-extrabold text-white">
                  <Avatar path={profileImageUrl} nickname={nickname} size={44} />
                </div>
                <div className="min-w-0">
                  <div className="text-[14.5px] font-extrabold">{nickname ?? "사용자"}</div>
                  <div className="truncate text-xs text-[#9A9AA2]">{email ?? ""}</div>
                  {pointBalance !== null && (
                    <div className="mt-0.5 text-xs font-bold text-primary">
                      {pointBalance.toLocaleString("ko-KR")} P
                    </div>
                  )}
                </div>
              </div>
              <div className="h-px bg-[#F0F0F0]" />
              <div className="p-2">
                {(role === "admin" ? [...ADMIN_MENU, ...PROFILE_MENU] : PROFILE_MENU).map((m) =>
                  m.href ? (
                    <Link
                      key={m.label}
                      href={m.href}
                      // 이동해도 드롭다운이 새 페이지 위에 남는다 — pathname 변화 감지는 모바일 메뉴만 닫는다.
                      onClick={() => setOpen(null)}
                      className="flex items-center gap-2.5 rounded-[9px] px-3 py-2.5 text-[13.5px] font-semibold text-[#3A3A42] hover:bg-[#F5F5F7] hover:text-ink"
                    >
                      {m.label}
                    </Link>
                  ) : (
                    <div
                      key={m.label}
                      aria-disabled="true"
                      className="flex cursor-default items-center gap-2.5 rounded-[9px] px-3 py-2.5 text-[13.5px] font-semibold text-[#B4B4BC]"
                    >
                      <span className="flex-1">{m.label}</span>
                      <span className="text-[10.5px] font-bold">준비 중</span>
                    </div>
                  ),
                )}
              </div>
              <div className="h-px bg-[#F0F0F0]" />
              <div className="p-2">
                <button
                  onClick={async () => {
                    setOpen(null);
                    await logout();
                    router.push("/");
                  }}
                  className="flex w-full items-center gap-2.5 rounded-[9px] px-3 py-2.5 text-left text-[13.5px] font-bold text-primary hover:bg-[#FFF5F5] hover:text-primary"
                >
                  로그아웃
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export default function Header() {
  const pathname = usePathname() || "/";
  const isLoggedIn = useUserStore((s) => s.isLoggedIn);
  const status = useUserStore((s) => s.status);
  const role = useUserStore((s) => s.role);
  const variant: "loading" | "in" | "out" | "admin" =
    status === "loading"
      ? "loading"
      : status === "unauthenticated"
        ? "out"
        : role === "admin"
          ? "admin"
          : "in";

  const mobileMenuId = useId();
  // 알림/프로필 드롭다운(LoggedInRight)과 모바일 메뉴 드로어가 이 값 하나를 공유한다 —
  // 동시에 하나만 열릴 수 있어서, 하나가 열린 채로 다른 트리거를 눌러도 백드롭끼리
  // 클릭을 가로채는 충돌이 타입 레벨에서 아예 발생하지 않는다.
  const [open, setOpen] = useState<HeaderPanel>(null);
  // ESC/스크롤락은 모바일 메뉴에만 좁게 적용 — 알림/프로필 드롭다운은 이 state 통합 이전과
  // 동일하게 이 동작이 없던 상태를 그대로 유지한다(의도적으로 범위를 넓히지 않음).
  useEscapeAndScrollLock(open === "menu", () => setOpen(null));

  // 페이지 이동(네비 링크 클릭 외의 경로 — 뒤로가기 등) 시에도 열려있던 모바일 메뉴를 닫는다.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    if (open === "menu") setOpen(null);
  }

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-[#F0F0F0] bg-white px-4 sm:px-10">
      <div className="flex items-center gap-11">
        <Link
          href="/"
          className="whitespace-nowrap text-xl font-extrabold tracking-[-0.5px] text-primary hover:text-primary"
        >
          POCKET TRADE
        </Link>
        <nav className="hidden items-center gap-[30px] text-[15px] font-semibold md:flex">
          {NAV.map((n) => {
            const isActive =
              n.href !== "#" &&
              (pathname === n.href ||
                pathname.startsWith(n.href + "/") ||
                // 카드 상세(/cards/[id])는 시맨틱상 마켓 하위라 "마켓"을 활성 처리한다.
                (n.href === "/search" && pathname.startsWith("/cards/")));
            return (
              <Link
                key={n.label}
                href={n.href}
                className={
                  isActive
                    ? "whitespace-nowrap border-b-2 border-primary py-1 text-primary hover:text-primary"
                    : "whitespace-nowrap py-1 text-[#4B4B52] hover:text-primary"
                }
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-4">
        {variant === "loading" && <div className="h-10 w-10 rounded-full bg-neutral" />}
        {variant === "out" && (
          <>
            <SearchBar width="hidden w-56 md:block" />
            <Link
              href="/login"
              className="whitespace-nowrap px-1.5 py-2 text-[14.5px] font-bold text-[#4B4B52] hover:text-primary"
            >
              로그인
            </Link>
            <Link
              href="/signup"
              className="whitespace-nowrap rounded-[10px] border-2 border-primary-dark bg-primary px-[18px] py-[9px] text-[14.5px] font-bold text-white shadow-tactile-sm hover:bg-[#D91212] hover:text-white"
            >
              회원가입
            </Link>
          </>
        )}

        {/* 관리자도 결국 로그인한 사용자다 — 알림·마이페이지·로그아웃이 똑같이 필요하므로
            LoggedInRight를 그대로 쓰고 운영자 배지만 앞에 붙인다. 따로 만들어두면 일반 메뉴가
            바뀔 때마다 관리자 쪽이 뒤처지고, 실제로 로그아웃 수단이 없는 상태였다. */}
        {(variant === "in" || variant === "admin") && (
          <>
            {variant === "admin" && (
              <span className="whitespace-nowrap rounded-full border border-[#F6D0D0] bg-[#FFF5F5] px-[11px] py-[5px] text-xs font-extrabold text-primary">
                운영자
              </span>
            )}
            <LoggedInRight open={open} setOpen={setOpen} />
          </>
        )}

        <button
          type="button"
          aria-label={open === "menu" ? "메뉴 닫기" : "메뉴 열기"}
          aria-expanded={open === "menu"}
          aria-controls={mobileMenuId}
          onClick={() => setOpen((o) => (o === "menu" ? null : "menu"))}
          className="flex h-10 w-10 items-center justify-center rounded-[9px] bg-neutral transition-colors hover:bg-[#ECECEF] md:hidden"
        >
          {open === "menu" ? (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#4B4B52"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#4B4B52"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M4 6h16" />
              <path d="M4 12h16" />
              <path d="M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* 알림/프로필 패널과 같은 이유로 header 스태킹 컨텍스트 밖(document.body)으로 Portal한다.
          header가 더 이상 containing block이 아니므로 top-full 대신 header 높이 그대로인
          top-16을 쓰고, left-0 right-0는 이미 전체 폭이라 별도 좌우 패딩 래퍼 없이 그대로 fixed로 바꾼다. */}
      {open === "menu" &&
        createPortal(
          <>
            <div
              onClick={() => setOpen(null)}
              aria-hidden="true"
              className="fixed inset-x-0 bottom-0 top-16 z-[80] md:hidden"
            />
            <div
              id={mobileMenuId}
              aria-label="메뉴"
              className="fixed inset-x-0 top-16 z-[90] border-b border-[#EDEDF0] bg-white p-4 shadow-[0_14px_38px_rgba(20,26,52,0.18)] md:hidden"
            >
              {/* 관리자만 모바일 메뉴에서 검색이 빠져 있었다 — 같은 원인(관리자를 별종 취급)의 누락. */}
              {variant !== "loading" && (
                <div className="mb-3">
                  <SearchBar width="w-full" />
                </div>
              )}
              <nav className="flex flex-col gap-1">
                {NAV.map((n) => {
                  const isActive =
                    n.href !== "#" &&
                    (pathname === n.href ||
                      pathname.startsWith(n.href + "/") ||
                      // 카드 상세(/cards/[id])는 시맨틱상 마켓 하위라 "마켓"을 활성 처리한다.
                      (n.href === "/search" && pathname.startsWith("/cards/")));
                  return (
                    <Link
                      key={n.label}
                      href={n.href}
                      onClick={() => setOpen(null)}
                      className={
                        isActive
                          ? "rounded-[9px] bg-[#FFF5F5] px-3 py-2.5 text-[14.5px] font-bold text-primary"
                          : "rounded-[9px] px-3 py-2.5 text-[14.5px] font-semibold text-[#3A3A42] hover:bg-[#F5F5F7]"
                      }
                    >
                      {n.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </>,
          document.body,
        )}
    </header>
  );
}
