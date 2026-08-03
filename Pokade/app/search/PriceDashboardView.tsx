import GradeBadge, { Grade } from "@/components/GradeBadge";
import CardImage from "@/components/CardImage";

// /search의 "시세 대시보드" 탭 — 목업 데이터로만 구성된 정적 뷰(백엔드 연동 전).
export default function PriceDashboardView() {
  return (
    <div className="grid grid-cols-1 items-start gap-[22px] lg:grid-cols-[60fr_40fr]">
      <div className="flex flex-col gap-5">
        <div className="rounded-2xl border border-t-[3px] border-[#EDEDF0] border-t-primary bg-white px-7 py-[26px]">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[13.5px] font-semibold text-[#8A8A92]">리자몽 ex (S) 시세</div>
              <div className="mt-1.5 flex items-baseline gap-2.5">
                <span className="text-[32px] font-extrabold tracking-[-1px]">₩142,000</span>
                <span className="text-sm font-bold text-primary">▲ 3.2% (4,400)</span>
              </div>
            </div>
            <div className="flex gap-1.5">
              <span className="rounded-md bg-primary px-[11px] py-[5px] text-xs font-bold text-white">
                7D
              </span>
              <span className="rounded-md bg-[#F2F2F5] px-[11px] py-[5px] text-xs font-bold text-[#8A8A92]">
                1M
              </span>
              <span className="rounded-md bg-[#F2F2F5] px-[11px] py-[5px] text-xs font-bold text-[#8A8A92]">
                1Y
              </span>
            </div>
          </div>
          <div className="mt-6 flex h-[170px] items-end gap-3">
            {[48, 56, 44, 68].map((h, i) => (
              <div key={i} className="flex-1 rounded-t-[5px] bg-secondary" style={{ height: `${h}%` }} />
            ))}
            {[62, 82, 100].map((h, i) => (
              <div key={i} className="flex-1 rounded-t-[5px] bg-primary" style={{ height: `${h}%` }} />
            ))}
          </div>
          <div className="mt-2.5 flex justify-between text-[11px] text-[#A8A8B0]">
            {["7/16", "7/17", "7/18", "7/19", "7/20", "7/21", "오늘"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-[#EDEDF0] bg-white px-7 py-6">
          <h2 className="mb-4 mt-0 text-base font-extrabold">최근 거래 내역</h2>
          <div className="grid grid-cols-4 border-b border-[#EDEDF0] pb-[11px] text-xs font-bold text-[#9A9AA2]">
            <span>등급</span>
            <span>체결가</span>
            <span>변동</span>
            <span className="text-right">시각</span>
          </div>
          {[
            { g: "S" as Grade, p: "₩142,000", c: "▲ 3.2%", up: true, t: "2분 전" },
            { g: "A" as Grade, p: "₩98,000", c: "▲ 1.1%", up: true, t: "18분 전" },
            { g: "S" as Grade, p: "₩139,500", c: "▼ 0.7%", up: false, t: "1시간 전" },
            { g: "B" as Grade, p: "₩61,000", c: "▲ 2.0%", up: true, t: "3시간 전" },
          ].map((r, i, a) => (
            <div
              key={i}
              className={`grid grid-cols-4 items-center py-3 text-[13.5px] ${i < a.length - 1 ? "border-b border-[#F5F5F7]" : ""}`}
            >
              <span>
                <GradeBadge grade={r.g} size="md" />
              </span>
              <span className="font-bold">{r.p}</span>
              <span className={`font-bold ${r.up ? "text-primary" : "text-secondary"}`}>{r.c}</span>
              <span className="text-right text-[#9A9AA2]">{r.t}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-5">
        <div className="rounded-2xl border border-[#EDEDF0] bg-white p-6">
          <div className="flex gap-4">
            <div className="relative h-[132px] w-24 flex-shrink-0 overflow-hidden rounded-[10px] bg-[#F2F2F5]">
              <CardImage />
              <GradeBadge grade="S" size="sm" className="absolute left-[7px] top-[7px]" />
            </div>
            <div className="flex-1">
              <div className="text-[17px] font-extrabold">리자몽 ex</div>
              <div className="mt-[3px] text-[12.5px] text-[#9A9AA2]">흑염의 지배자 · SAR</div>
              <div className="mt-3.5 flex flex-col gap-[7px] text-[12.5px]">
                {[
                  ["최고가", "₩158,000"],
                  ["최저가", "₩121,000"],
                  ["거래량(7D)", "342건"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-[#8A8A92]">{k}</span>
                    <span className="font-bold">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <button className="mt-[18px] w-full rounded-[11px] border-2 border-primary-dark bg-primary py-3 text-[14.5px] font-bold text-white shadow-tactile-sm active:translate-y-0.5">
            워치리스트에 추가
          </button>
        </div>
        <div className="rounded-2xl border border-[#EDEDF0] bg-white p-6">
          <h2 className="mb-3.5 mt-0 text-[15px] font-extrabold">추천 카드</h2>
          <div className="flex flex-col gap-3.5">
            {[
              { n: "뮤츠 ex", s: "레이징 서프 · SAR", p: "₩211,000", c: "▲ 1.1%", up: true },
              { n: "뮤 UR", s: "151 · UR", p: "₩89,500", c: "▼ 1.4%", up: false },
              {
                n: "칠색조 ex",
                s: "파라다임 트리거 · SAR",
                p: "₩118,000",
                c: "▲ 4.6%",
                up: true,
              },
            ].map((r) => (
              <div key={r.n} className="flex items-center gap-3">
                <div className="h-14 w-10 flex-shrink-0 overflow-hidden rounded-[7px] bg-[#F2F2F5]">
                  <CardImage />
                </div>
                <div className="flex-1">
                  <div className="text-[13.5px] font-bold">{r.n}</div>
                  <div className="text-[11.5px] text-[#9A9AA2]">{r.s}</div>
                </div>
                <div className="text-right">
                  <div className="text-[13.5px] font-extrabold">{r.p}</div>
                  <div className={`text-[11.5px] font-bold ${r.up ? "text-primary" : "text-secondary"}`}>
                    {r.c}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
