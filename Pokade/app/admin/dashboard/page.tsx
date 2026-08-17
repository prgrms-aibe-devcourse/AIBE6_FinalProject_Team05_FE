"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AdminSidebar from "@/components/AdminSidebar";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { ApiError } from "@/lib/apiClient";
import { fetchAdminDashboard } from "@/lib/adminApi";
import {
  AdminDashboardResponse,
  AdminMetricsPeriod,
  AdminMetricSeriesResponse,
} from "@/types/adminMetrics";

type LoadState = "loading" | "error" | "ready";

const SERIES_COLORS: Record<string, string> = {
  visits: "#FFCB05",
  aiGrade: "#3B4CCA",
  tradesConfirmed: "#16A34A",
  httpErrorRate: "#EE1515",
  avgLatency: "#8B5CF6",
};

// com.pokade.domain.admin.metrics.AdminMetricsPeriod와 짝 맞춤 (10m→1시간, 1h→6시간, 1d→7일 조회).
const PERIODS: AdminMetricsPeriod[] = ["10m", "1h", "1d"];

const GROUP_TITLES: Record<string, string> = {
  activity: "이용 현황",
  errorRate: "HTTP 5xx 에러율 추이",
  latency: "평균 응답 지연 추이",
};

function formatSeriesValue(value: number, unit: string): string {
  if (unit === "%") return `${value.toFixed(2)}%`;
  return `${Math.round(value).toLocaleString("ko-KR")}${unit}`;
}

function formatCardValue(value: number | null, unit: string): string {
  if (value === null) return "데이터 없음";
  if (unit === "%") return `${value.toFixed(2)}%`;
  if (unit === "ms") return `${Math.round(value).toLocaleString("ko-KR")}ms`;
  return `${Math.round(value).toLocaleString("ko-KR")}${unit}`;
}

// 1일 단위는 시:분이 다 자정 근처라 의미가 없으므로 날짜(MM/DD)로, 나머지는 시:분으로 보여준다.
function formatAxisTick(epochSeconds: number, period: AdminMetricsPeriod) {
  const d = new Date(epochSeconds * 1000);
  if (period === "1d") return `${d.getMonth() + 1}/${d.getDate()}`;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 시리즈별로 따로 오는 응답을 epochSeconds 기준 한 행으로 합쳐, 한 차트에 여러 Line을 겹쳐 그린다
// (PriceChart.tsx가 등급별 응답을 날짜 기준으로 합치는 것과 같은 패턴).
function buildCombinedSeries(series: AdminMetricSeriesResponse[]) {
  const byTime = new Map<number, { epochSeconds: number; [key: string]: number }>();
  for (const s of series) {
    for (const p of s.points) {
      const row = byTime.get(p.epochSeconds) ?? { epochSeconds: p.epochSeconds };
      row[s.key] = p.value;
      byTime.set(p.epochSeconds, row);
    }
  }
  const points = Array.from(byTime.values()).sort((a, b) => a.epochSeconds - b.epochSeconds);
  const unitByKey = new Map(series.map((s) => [s.key, s.unit]));
  const labelByKey = new Map(series.map((s) => [s.key, s.label]));
  return { points, unitByKey, labelByKey };
}

// group별로 시리즈를 묶는다 - 같은 group끼리만 스케일이 맞아 한 차트에 겹쳐 그릴 수 있다(BE가 정함).
function groupSeries(series: AdminMetricSeriesResponse[]) {
  const byGroup = new Map<string, AdminMetricSeriesResponse[]>();
  for (const s of series) {
    const list = byGroup.get(s.group) ?? [];
    list.push(s);
    byGroup.set(s.group, list);
  }
  return Array.from(byGroup.entries());
}

export default function AdminDashboardPage() {
  useRequireAuth();
  const [period, setPeriod] = useState<AdminMetricsPeriod>("1h");
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [dashboard, setDashboard] = useState<AdminDashboardResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    // period 버튼을 바꿀 때마다 재조회 스피너를 다시 보여주기 위해 필요 — 의도적으로 유지.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadState("loading");
    fetchAdminDashboard(period)
      .then((data) => {
        if (cancelled) return;
        setDashboard(data);
        setLoadState("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMessage(
          err instanceof ApiError ? err.message : "지표를 불러오지 못했습니다.",
        );
        setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  const seriesGroups = useMemo(
    () =>
      dashboard
        ? groupSeries(dashboard.series).map(([group, series]) => ({
            group,
            series,
            combined: buildCombinedSeries(series),
          }))
        : [],
    [dashboard],
  );

  return (
    <main className="main-content flex bg-neutral">
      <AdminSidebar />

      <div className="min-w-0 flex-1 px-9 py-8">
        <h1 className="mb-1 mt-0 text-2xl font-extrabold tracking-[-0.5px]">운영 현황 대시보드</h1>
        <p className="mb-[22px] text-[13.5px] text-[#8A8A92]">
          서비스에 계측된 지표로 운영 현황을 확인합니다
        </p>

        {loadState === "loading" && (
          <div className="flex h-[200px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#E7E7EB] border-t-primary" />
          </div>
        )}

        {loadState === "error" && (
          <div className="rounded-2xl border border-[#F6C6C6] bg-[#FFF1F1] px-5 py-4 text-[13.5px] font-semibold text-[#C21414]">
            {errorMessage}
          </div>
        )}

        {loadState === "ready" && dashboard && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {dashboard.cards.map((card) => (
                <div key={card.key} className="rounded-2xl border border-[#EDEDF0] bg-white p-6">
                  <div className="text-[13px] font-semibold text-[#8A8A92]">{card.label}</div>
                  <div className="mt-2 text-[26px] font-extrabold tracking-[-0.5px]">
                    {formatCardValue(card.value, card.unit)}
                  </div>
                  {card.subLabel && card.subValue !== null && (
                    <div className="mt-1 text-[12.5px] font-bold text-primary">
                      {card.subLabel} +{Math.round(card.subValue).toLocaleString("ko-KR")}
                      {card.unit}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-5 flex gap-1.5">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition ${
                    period === p
                      ? "bg-primary text-white"
                      : "bg-white text-[#8A8A92] hover:text-primary"
                  } border border-[#EDEDF0]`}
                >
                  {p}
                </button>
              ))}
            </div>

            {seriesGroups.map(({ group, series, combined }) => (
              <div key={group} className="mt-3 rounded-2xl border border-[#EDEDF0] bg-white p-6">
                <h2 className="mb-3 text-[15px] font-extrabold">
                  {GROUP_TITLES[group] ?? series[0]?.label}
                </h2>
                {combined.points.length === 0 ? (
                  <div className="flex h-[300px] items-center justify-center text-[13.5px] text-[#9A9AA2]">
                    아직 데이터가 없습니다.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={combined.points} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EDEDF0" />
                      <XAxis
                        dataKey="epochSeconds"
                        tickFormatter={(v) => formatAxisTick(v, period)}
                        tick={{ fontSize: 10.5, fill: "#8A8A92" }}
                        axisLine={{ stroke: "#EDEDF0" }}
                        tickLine={false}
                        minTickGap={24}
                      />
                      <YAxis
                        tick={{ fontSize: 10.5, fill: "#8A8A92" }}
                        axisLine={{ stroke: "#EDEDF0" }}
                        tickLine={false}
                        width={48}
                        allowDecimals={false}
                      />
                      <Tooltip
                        labelFormatter={(label) => formatAxisTick(Number(label), period)}
                        formatter={(value, name) => [
                          formatSeriesValue(Number(value), combined.unitByKey.get(String(name)) ?? ""),
                          combined.labelByKey.get(String(name)) ?? String(name),
                        ]}
                        contentStyle={{ borderRadius: 12, border: "1px solid #EDEDF0", fontSize: 12.5 }}
                      />
                      {series.length > 1 && (
                        <Legend
                          formatter={(value: string) => combined.labelByKey.get(value) ?? value}
                          wrapperStyle={{ fontSize: 12, fontWeight: 700 }}
                        />
                      )}
                      {series.map((s) => (
                        <Line
                          key={s.key}
                          type="monotone"
                          dataKey={s.key}
                          name={s.key}
                          stroke={SERIES_COLORS[s.key] ?? "#8A8A92"}
                          strokeWidth={2}
                          dot={false}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </main>
  );
}
