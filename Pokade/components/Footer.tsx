import Link from "next/link";

const LINKS = [
  { label: "이용약관", href: "/terms" },
  { label: "개인정보처리방침", href: "/privacy" },
  { label: "고객센터", href: "/support" },
];

export default function Footer() {
  return (
    <footer className="footer border-t border-primary bg-lavender px-10 py-7">
      <div className="mx-auto flex max-w-container flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-base font-extrabold tracking-[-0.3px] text-ink">POCKET TRADE</div>
          <div className="mt-[5px] text-[12.5px] text-[#6E6E86]">
            © 2026 POCKET TRADE. Retro-Grade Trading Card Marketplace.
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
