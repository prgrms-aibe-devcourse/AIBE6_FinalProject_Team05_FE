import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import { loginUrlFor } from "@/lib/authRedirect";

// 로그인이 필요한 페이지에서 쓰는 공용 가드.
// router.replace로 리다이렉트해서 히스토리 엔트리를 추가하지 않는다 —
// push를 쓰면 뒤로가기 때마다 이 페이지로 재마운트되어 다시 리다이렉트가 발동하고,
// 페이지↔로그인 사이에 히스토리가 계속 쌓여 이전 페이지로 못 돌아가는 문제가 생긴다.
export function useRequireAuth() {
  const router = useRouter();
  const pathname = usePathname();
  const authStatus = useUserStore((s) => s.status);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.replace(loginUrlFor(pathname));
    }
  }, [authStatus, pathname, router]);

  return authStatus;
}
