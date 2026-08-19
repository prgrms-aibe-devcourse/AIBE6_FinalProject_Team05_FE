"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MENU: { label: string; href: string }[] = [
  { label: "대시보드", href: "/admin/dashboard" },
  { label: "신고/제재 관리", href: "/admin/reports" },
  { label: "신고 매물 관리", href: "/admin/listings" },
  { label: "문의 관리", href: "/admin/inquiries" },
  { label: "회원 관리", href: "#" },
  { label: "거래 관리", href: "#" },
  { label: "정산 관리", href: "#" },
  { label: "공지 관리", href: "#" },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-[230px] flex-shrink-0 flex-col gap-1 bg-navy px-4 py-[26px]">
      <div className="px-3 pb-3 text-[11px] font-extrabold tracking-[1px] text-[#6B7290]">
        관리자 콘솔
      </div>
      {MENU.map(({ label, href }) => {
        const active = href !== "#" && pathname.startsWith(href);
        return (
          <Link
            key={label}
            href={href}
            className={`flex items-center gap-[11px] rounded-[10px] px-[13px] py-[11px] text-sm ${
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
