"use client";

import { useState } from "react";
import Link from "next/link";

interface Faq {
  q: string;
  a: string;
}

const CATEGORIES: { title: string; faqs: Faq[] }[] = [
  {
    title: "안전거래 & 정산",
    faqs: [
      {
        q: "안전거래(에스크로)는 어떻게 진행되나요?",
        a: "구매자가 결제한 대금은 Pokade가 안전하게 보관하고, 판매자가 발송한 실물 카드를 검수한 뒤 구매자가 수령을 확인하면 판매자에게 정산됩니다. 검수 결과 상품 정보와 실물이 다르면 거래가 취소되고 환불됩니다.",
      },
      {
        q: "정산은 언제, 얼마나 걸리나요?",
        a: "구매확정(또는 구매확정 간주) 이후 수수료를 제외한 금액이 정산 처리됩니다. 정산 주기와 수수료율은 서비스 내 판매자 정산 화면에서 확인할 수 있습니다.",
      },
      {
        q: "환불은 어떻게 요청하나요?",
        a: "구매확정 전 거래는 마이페이지의 거래 상세에서 취소·환불을 요청할 수 있습니다. 구매확정 이후 하자가 발견된 경우에는 1:1 채팅 상담을 통해 분쟁처리 절차를 안내받을 수 있습니다.",
      },
    ],
  },
  {
    title: "AI 등급진단",
    faqs: [
      {
        q: "AI 등급진단 결과를 그대로 믿고 거래해도 되나요?",
        a: "AI 등급진단은 업로드한 사진을 기반으로 한 참고용 예측치이며, 정식 감정기관의 감정 결과가 아닙니다. 촬영 환경에 따라 실제 상태와 차이가 있을 수 있으니 참고자료로만 활용해 주세요.",
      },
      {
        q: "진단 결과가 이상하게 나왔어요.",
        a: "밝고 그림자 없는 환경에서 카드 전체가 프레임에 들어오도록 재촬영 후 다시 진단해 보세요. 반복적으로 문제가 있다면 1:1 채팅 상담으로 문의해 주세요.",
      },
    ],
  },
  {
    title: "회원 & 계정",
    faqs: [
      {
        q: "비밀번호를 잊어버렸어요.",
        a: "로그인 화면의 '비밀번호 찾기'에서 가입 시 등록한 이메일로 재설정 링크를 받을 수 있습니다.",
      },
      {
        q: "회원탈퇴는 어떻게 하나요?",
        a: "마이페이지 > 계정 설정에서 탈퇴를 신청할 수 있습니다. 다만 진행 중인 거래나 정산이 끝나지 않은 안전거래가 있다면 해당 절차가 끝난 뒤에 탈퇴 처리됩니다.",
      },
    ],
  },
];

export default function SupportPage() {
  const [openIndex, setOpenIndex] = useState<string | null>(null);

  return (
    <main className="main-content bg-white">
      <section className="bg-neutral px-6 py-14 sm:px-10">
        <div className="mx-auto max-w-container text-center">
          <h1 className="text-[28px] font-extrabold tracking-[-0.5px] text-ink">고객센터</h1>
          <p className="mt-2.5 text-[15px] text-[#6E6E76]">
            자주 묻는 질문을 먼저 확인해보시고, 해결되지 않으면 1:1 채팅 상담으로 문의해 주세요.
          </p>
        </div>
      </section>

      <section className="px-6 py-14 sm:px-10">
        <div className="mx-auto grid max-w-container grid-cols-1 gap-11 lg:grid-cols-[68fr_32fr]">
          <div className="flex flex-col gap-10">
            {CATEGORIES.map((category) => (
              <div key={category.title}>
                <h2 className="text-lg font-extrabold text-ink">{category.title}</h2>
                <div className="mt-4 flex flex-col gap-2.5">
                  {category.faqs.map((faq) => {
                    const key = `${category.title}-${faq.q}`;
                    const isOpen = openIndex === key;
                    return (
                      <div
                        key={key}
                        className="overflow-hidden rounded-[14px] border border-[#EDEDF0]"
                      >
                        <button
                          type="button"
                          onClick={() => setOpenIndex(isOpen ? null : key)}
                          aria-expanded={isOpen}
                          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-[14.5px] font-bold text-ink hover:bg-[#FAFAFB]"
                        >
                          <span>{faq.q}</span>
                          <span
                            className={`flex-shrink-0 text-lg text-[#9A9AA2] transition-transform ${isOpen ? "rotate-45" : ""}`}
                          >
                            +
                          </span>
                        </button>
                        {isOpen && (
                          <p className="whitespace-pre-line border-t border-[#F0F0F0] bg-[#FAFAFB] px-5 py-4 text-sm leading-relaxed text-[#4B4B55]">
                            {faq.a}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <aside className="flex h-fit flex-col gap-3 rounded-2xl border border-[#EDEDF0] bg-neutral p-6">
            <h3 className="text-base font-extrabold text-ink">더 궁금한 점이 있으신가요?</h3>
            <p className="text-sm leading-relaxed text-[#6E6E76]">
              시세, 거래, 진단 결과에 대한 질문은 1:1 채팅 상담을 통해 실시간으로 도와드립니다.
              사진 첨부가 필요하거나 답변까지 시간이 걸려도 괜찮다면 1:1 문의를 남겨주세요.
            </p>
            <Link
              href="/chat"
              className="mt-1 inline-block rounded-[11px] border-2 border-primary-dark bg-primary px-5 py-3 text-center text-[14.5px] font-bold text-white shadow-tactile transition hover:text-white hover:shadow-tactile-hover active:translate-y-0.5 active:shadow-tactile-active"
            >
              1:1 채팅 상담 하기
            </Link>
            <Link
              href="/inquiries/new"
              className="inline-block rounded-[11px] border-[1.5px] border-[#DDDDE3] bg-white px-5 py-3 text-center text-[14.5px] font-bold text-[#4B4B52] transition hover:bg-[#F4F4F6]"
            >
              1:1 문의 작성하기
            </Link>
            <div className="mt-3 border-t border-[#E5E5EA] pt-3 text-[13px] leading-relaxed text-[#8A8A92]">
              <div>이메일: support@pockettrade.example</div>
              <div>운영시간: 평일 10:00 ~ 18:00 (주말·공휴일 휴무)</div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
