import { Fragment } from "react";
import Link from "next/link";
import type { MouseEventHandler } from "react";

export type BreadcrumbItem = {
  label: string;
  href?: string;
  // 링크에 부가 동작을 물릴 때 사용(예: 카드 상세의 "마켓"이 직전 검색 필터로 복귀).
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

// 현재 위치 계층("홈 › 마켓 › 카드명")을 보여주는 공용 브레드크럼.
// href가 있는 항목은 링크로, 마지막 항목은 항상 현재 위치(비링크)로 렌더한다.
// 마지막 라벨이 길면 잘라내고 title로 전체를 노출한다.
export default function Breadcrumb({
  items,
  className = "",
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  return (
    <nav aria-label="현재 위치" className={`min-w-0 ${className}`}>
      <ol className="flex items-center gap-1.5 text-[13px] font-semibold text-[#8A8A92]">
        {items.map((item, i) => {
          const isCurrent = i === items.length - 1;
          return (
            <Fragment key={item.label}>
              {i > 0 && (
                <li aria-hidden="true" className="shrink-0 text-[#C7C7CE]">
                  ›
                </li>
              )}
              {item.href && !isCurrent ? (
                <li className="shrink-0">
                  <Link href={item.href} onClick={item.onClick} className="hover:text-primary">
                    {item.label}
                  </Link>
                </li>
              ) : isCurrent ? (
                // 마지막(현재 위치) 항목만 aria-current="page".
                <li aria-current="page" className="truncate font-bold text-ink" title={item.label}>
                  {item.label}
                </li>
              ) : (
                // href 없는 중간 항목 — 링크도 현재 위치도 아니므로 평범한 텍스트로 둔다
                // (aria-current를 붙이면 스크린리더가 현재 위치로 잘못 안내한다).
                <li className="shrink-0">{item.label}</li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
