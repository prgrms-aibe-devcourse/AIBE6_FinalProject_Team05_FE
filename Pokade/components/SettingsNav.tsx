"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";

export default function SettingsNav() {
  const pathname = usePathname();
  const provider = useUserStore((s) => s.provider);
  const accountStatus = useUserStore((s) => s.accountStatus);

  // 소셜 계정은 비밀번호가 없고, 이미 탈퇴를 신청했으면 다시 신청할 수 없다.
  // 값이 null인 동안(프로필 복원 중)에는 노출하지 않는다 — 잠깐 떴다 사라지는 편이 낫다.
  const menu = [
    { label: "내 정보", href: "/settings" },
    ...(provider === "LOCAL" ? [{ label: "비밀번호 변경", href: "/settings/password" }] : []),
    ...(accountStatus === "ACTIVE" ? [{ label: "회원 탈퇴", href: "/settings/withdrawal" }] : []),
  ];

  return (
    <nav className="flex gap-1 overflow-x-auto md:w-[180px] md:flex-shrink-0 md:flex-col md:overflow-visible">
      {menu.map(({ label, href }) => {
        // "/settings"는 하위 경로의 접두사라 startsWith로 판정하면 항상 함께 켜진다.
        // 인덱스 라우트만 정확히 일치로 판정한다.
        const active =
          href === "/settings"
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-[10px] px-[13px] py-[11px] text-sm ${
              active
                ? "bg-primary font-bold text-white hover:text-white"
                : "font-semibold text-[#6E6E76] hover:bg-[#F5F5F7] hover:text-ink"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
