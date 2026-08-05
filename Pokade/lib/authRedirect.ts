// 로그인 후 원래 있던 위치로 돌아가기 위한 /login?redirect=... URL 생성.
// searchParams를 넘기면 현재 쿼리스트림(예: ?tab=history)까지 포함해 되돌아간다.
export function loginUrlFor(pathname: string, searchParams?: URLSearchParams): string {
  const qs = searchParams?.toString();
  const target = qs ? `${pathname}?${qs}` : pathname;
  return `/login?redirect=${encodeURIComponent(target)}`;
}
