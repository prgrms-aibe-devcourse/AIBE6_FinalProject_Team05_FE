"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// href가 없으면 아직 화면이 없는 메뉴다.
const MENU: { label: string; href?: string }[] = [
  { label: "대시보드", href: "/admin/dashboard" },
  { label: "신고/제재 관리", href: "/admin/reports" },
  { label: "신고 매물 관리", href: "/admin/listings" },
  { label: "문의 관리", href: "/admin/inquiries" },
  { label: "거래 관리", href: "/admin/trades" },
  { label: "회원 관리" },
  { label: "정산 관리" },
  { label: "공지 관리" },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-[230px] flex-shrink-0 flex-col gap-1 bg-navy px-4 py-[26px]">
      <div className="px-3 pb-3 text-[11px] font-extrabold tracking-[1px] text-[#6B7290]">
        관리자 콘솔
      </div>
      {MENU.map(({ label, href }) => {
        const base = "flex items-center gap-[11px] rounded-[10px] px-[13px] py-[11px] text-sm";

        // 화면이 없는 메뉴는 링크로 만들지 않는다 — 눌러도 반응이 없으면 고장으로 읽힌다.
        if (!href) {
          return (
            <div
              key={label}
              aria-disabled="true"
              className={`${base} cursor-default font-semibold text-[#5D6486]`}
            >
              <span className="h-[7px] w-[7px] rounded-sm bg-[#3B4265]" />
              <span className="flex-1">{label}</span>
              <span className="text-[10.5px] font-bold text-[#5D6486]">준비 중</span>
            </div>
          );
        }

        // 경계를 확인하지 않으면 나중에 /admin/trades-history 같은 경로가 생겼을 때
        // /admin/trades 메뉴까지 함께 활성화된다. Header.tsx의 NAV와 같은 판정을 쓴다.
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={label}
            href={href}
            className={`${base} ${
              active
                ? "bg-primary font-bold text-white hover:text-white"
                : "font-semibold text-[#A7ADC4] hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            <span
              className={`h-[7px] w-[7px] rounded-sm ${active ? "bg-white" : "bg-[#4B5478]"}`}
            />
            {label}
          </Link>
        );
      })}
    </aside>
  );
}
