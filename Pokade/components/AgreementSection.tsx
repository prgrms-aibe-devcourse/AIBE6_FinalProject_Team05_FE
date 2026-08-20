"use client";

import Link from "next/link";

// 가입 시 받는 동의 4종, 필수 3개와 선택 1개로 나뉘며 BE 요청 필드명과 키를 맞춘다.
export interface Agreements {
  termsOfService: boolean;
  privacyPolicy: boolean;
  thirdPartySharing: boolean;
  marketing: boolean;
}

export const EMPTY_AGREEMENTS: Agreements = {
  termsOfService: false,
  privacyPolicy: false,
  thirdPartySharing: false,
  marketing: false,
};

// 제3자 정보제공은 별도 페이지가 없다 - 개인정보처리방침 안의 항목이라 /privacy로 보낸다.
const ITEMS: { key: keyof Agreements; label: string; required: boolean; href?: string }[] = [
  { key: "termsOfService", label: "이용약관", required: true, href: "/terms" },
  { key: "privacyPolicy", label: "개인정보 수집·이용", required: true, href: "/privacy" },
  { key: "thirdPartySharing", label: "제3자 정보제공", required: true, href: "/privacy" },
  { key: "marketing", label: "마케팅 정보 수신", required: false },
];

// 필수 3종이 모두 체크됐는지 - 제출 버튼 활성화 판정에 쓴다
export function isRequiredAgreed(value: Agreements): boolean {
  return ITEMS.filter((i) => i.required).every((i) => value[i.key]);
}

export default function AgreementSection({
  value,
  onChange,
}: {
  value: Agreements;
  onChange: (next: Agreements) => void;
}) {
  const allChecked = ITEMS.every((i) => value[i.key]);

  function toggleAll(checked: boolean) {
    onChange({
      termsOfService: checked,
      privacyPolicy: checked,
      thirdPartySharing: checked,
      marketing: checked,
    });
  }
  return (
    <div className="rounded-[12px] border border-[#EDEDF0] px-4 py-3.5">
      <label className="flex cursor-pointer items-center gap-2.5 text-[14px] font-bold text-ink">
        <input
          type="checkbox"
          checked={allChecked}
          onChange={(e) => toggleAll(e.target.checked)}
          className="h-[17px] w-[17px]"
        />
        전체 동의
      </label>

      <div className="mt-3 h-px bg-[#F0F0F0]" />

      <div className="mt-3 flex flex-col gap-2.5">
        {ITEMS.map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-2">
            <label className="flex cursor-pointer items-center gap-2.5 text-[13.5px] text-[#4B4B52]">
              <input
                type="checkbox"
                checked={value[item.key]}
                onChange={(e) => onChange({ ...value, [item.key]: e.target.checked })}
                className="h-4 w-4"
              />
              <span className={item.required ? "font-semibold text-[#6E6E76]" : "text-[#8A8A92]"}>
                [{item.required ? "필수" : "선택"}]
              </span>
              {item.label}
            </label>
            {item.href && (
              // 새 탭으로 연다 — 가입 폼에 입력하던 값이 날아가지 않도록.
              <Link
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 text-[12.5px] font-semibold text-[#8A8A92] underline hover:text-primary"
              >
                보기
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
