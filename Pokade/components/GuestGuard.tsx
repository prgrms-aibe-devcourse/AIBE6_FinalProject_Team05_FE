"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";

// 로그인하지 않은 사용자를 위한 화면(/login·/signup)을 감싸는 가드. AdminGuard와 방향이 반대다.
// 페이지마다 호출하지 않고 레이아웃에 두는 이유도 같다 — 화면이 늘어날 때 가드를 빠뜨리기 쉽다.
//
// 소셜 가입 마지막 화면은 제외한다. /signup/social은 이 레이아웃 아래에 있으면서
// 가입을 확정하는 순간 loginWithToken()으로 인증 상태가 되는데, 그때 가드가 발동하면
// 가입 완료 처리와 리다이렉트가 서로 경쟁한다.
const EXEMPT_PATHS = ["/signup/social"];

export default function GuestGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const status = useUserStore((s) => s.status);

  const exempt = EXEMPT_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  useEffect(() => {
    // replace를 쓰는 이유는 AdminGuard와 같다 — push는 히스토리를 쌓아
    // 뒤로가기 때마다 이 화면이 재마운트되며 리다이렉트가 다시 발동한다.
    if (!exempt && status === "authenticated") router.replace("/");
  }, [exempt, status, router]);

  // 세션 복원 중(loading)에는 그대로 렌더한다. AdminGuard가 인가 전에 화면을 가리는 것과
  // 반대되는 선택인데, 여기서 잘못 보이는 것은 "이미 로그인한 사람에게 로그인 폼이 한 프레임
  // 비치는 것"뿐이라 위험하지 않다. 반대로 loading에 스피너를 띄우면 이 화면의 대다수인
  // 미로그인 사용자가 매번 스피너를 먼저 보게 된다.
  if (!exempt && status === "authenticated") return null;

  return <>{children}</>;
}
