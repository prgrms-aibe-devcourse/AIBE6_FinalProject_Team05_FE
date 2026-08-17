import AdminSidebar from "@/components/AdminSidebar";

// TODO: 지금은 전부 목업 값 — 실제 지표는 Grafana 패널 임베드로 연결 예정.
const STATS: { label: string; value: string; sub?: string }[] = [
  { label: "누적 방문자 수", value: "128,540명" },
  { label: "오늘 방문자 수", value: "1,204명", sub: "+12.4%" },
  { label: "오늘 거래량", value: "87건" },
  { label: "누적 거래액", value: "₩1,204,500,000" },
];

export default function AdminDashboardPage() {
  return (
    <main className="main-content flex bg-neutral">
      <AdminSidebar />

      <div className="min-w-0 flex-1 px-9 py-8">
        <h1 className="mb-1 mt-0 text-2xl font-extrabold tracking-[-0.5px]">운영 현황 대시보드</h1>
        <p className="mb-[22px] text-[13.5px] text-[#8A8A92]">
          Grafana 지표를 기반으로 서비스 운영 현황을 확인합니다
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="rounded-2xl border border-[#EDEDF0] bg-white p-6">
              <div className="text-[13px] font-semibold text-[#8A8A92]">{s.label}</div>
              <div className="mt-2 text-[26px] font-extrabold tracking-[-0.5px]">{s.value}</div>
              {s.sub && (
                <div className="mt-1 text-[12.5px] font-bold text-primary">{s.sub}</div>
              )}
            </div>
          ))}
        </div>

        {/* Grafana 패널 임베드 자리 — 실제 연동 전까지는 안내 문구만 표시 */}
        <div className="mt-5 flex min-h-[380px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#DDDDE3] bg-white text-center">
          <div className="text-sm font-bold text-[#4B4B52]">Grafana 대시보드 연동 예정</div>
          <p className="mx-auto mt-2 max-w-[420px] text-[12.5px] leading-relaxed text-[#9A9AA2]">
            누적 방문자 수, 일일 거래량 등 상세 지표는 이 영역에 Grafana 패널을 임베드해서
            보여줄 예정입니다.
          </p>
        </div>
      </div>
    </main>
  );
}
