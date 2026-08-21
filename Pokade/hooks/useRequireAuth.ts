import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import { loginUrlFor } from "@/lib/authRedirect";

// 역할까지 요구했을 때만 나오는 "로그인은 했지만 권한이 없음" 상태를 스토어 status에 더한 것.
export type RequireAuthStatus = "loading" | "authenticated" | "unauthenticated" | "forbidden";

// 로그인이 필요한 페이지에서 쓰는 공용 가드. options.role을 주면 역할까지 확인한다.
// router.replace로 리다이렉트해서 히스토리 엔트리를 추가하지 않는다 —
// push를 쓰면 뒤로가기 때마다 이 페이지로 재마운트되어 다시 리다이렉트가 발동하고,
// 페이지↔로그인 사이에 히스토리가 계속 쌓여 이전 페이지로 못 돌아가는 문제가 생긴다.
export function useRequireAuth(options?: { role: "admin" }): RequireAuthStatus {
  const router = useRouter();
  const pathname = usePathname();
  const authStatus = useUserStore((s) => s.status);
  const role = useUserStore((s) => s.role);
  // 로그인은 확정됐지만 프로필을 아직 못 받은 구간 — 이 동안 role은 null이다.
  const roleRestoring = useUserStore((s) => s.userIdRestoring);
  const requiredRole = options?.role;

  // 역할을 요구하지 않으면 예전과 똑같이 스토어 status가 그대로 나간다.
  // 요구할 때, role이 확정되기 전에 판정하면 관리자가 새로고침할 때마다 튕기므로 loading으로 미룬다.
  // 프로필 조회가 재시도까지 실패하면 role은 null로 남는데, 권한을 확인할 수 없으므로 통과시키지 않는다.
  let status: RequireAuthStatus = authStatus;
  if (requiredRole && authStatus === "authenticated") {
    if (roleRestoring) status = "loading";
    else if (role !== requiredRole) status = "forbidden";
  }

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(loginUrlFor(pathname));
    } else if (status === "forbidden") {
      // 로그인은 되어 있으니 로그인 페이지로 보내봐야 그대로 돌아온다 — 홈으로 돌린다.
      router.replace("/");
    }
  }, [status, pathname, router]);

  return status;
}
