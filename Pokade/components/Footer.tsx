"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { label: "이용약관", href: "/terms" },
  { label: "개인정보처리방침", href: "/privacy" },
  { label: "고객센터", href: "/support" },
];

export default function Footer() {
  const pathname = usePathname() || "/";
  // "/"는 자체 푸터를 쓰는 독립 랜딩페이지라 공용 푸터를 숨긴다.
  if (pathname === "/") return null;

  return (
    <footer className="footer border-t border-primary bg-lavender px-10 py-7">
      <div className="mx-auto flex max-w-container flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-base font-extrabold tracking-[-0.3px] text-ink">POKADE</div>
          <div className="mt-[5px] text-[12.5px] text-[#6E6E86]">
            © 2026 POKADE. Retro-Grade Trading Card Marketplace.
          </div>
        </div>
        <div className="flex gap-[22px] text-[13px] font-semibold">
          {LINKS.map((l) => (
            <Link key={l.label} href={l.href} className="text-[#4B4B62] hover:text-primary">
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
