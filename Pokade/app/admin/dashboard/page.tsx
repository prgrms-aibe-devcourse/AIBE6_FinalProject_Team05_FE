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
import { ApiError } from "@/lib/apiClient";
import { fetchAdminDashboard } from "@/lib/adminApi";
import {
  AdminMetricCardResponse,
  AdminMetricsPeriod,
  AdminMetricSeriesResponse,
} from "@/types/adminMetrics";

type PageState = "loading" | "error" | "ready";

const DEFAULT_PERIOD: AdminMetricsPeriod = "1h";

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
  return Array.from(byGroup.keys());
}

export default function AdminDashboardPage() {
  const [pageState, setPageState] = useState<PageState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [cards, setCards] = useState<AdminMetricCardResponse[]>([]);
  const [groups, setGroups] = useState<string[]>([]);

  // 차트(그룹)별로 독립된 조회 단위 — 같은 페이지 안에서도 차트마다 다른 기간을 볼 수 있다.
  const [periodByGroup, setPeriodByGroup] = useState<Record<string, AdminMetricsPeriod>>({});
  // period별 시리즈 응답 캐시 — 이미 불러온 period면 재요청 없이 그대로 재사용한다(카드는 period와 무관해서
  // 최초 1회 응답의 것만 쓰고, 이후 캐시는 시리즈 갱신 용도로만 채워진다).
  const [seriesCache, setSeriesCache] = useState<
    Partial<Record<AdminMetricsPeriod, AdminMetricSeriesResponse[]>>
  >({});
  // 지금 막 불러오는 중인 "그룹:period" 조합 - 그 차트에만 로딩 표시를 하기 위함.
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetchAdminDashboard(DEFAULT_PERIOD)
      .then((data) => {
        if (cancelled) return;
        setCards(data.cards);
        const discoveredGroups = groupSeries(data.series);
        setGroups(discoveredGroups);
        setPeriodByGroup(Object.fromEntries(discoveredGroups.map((g) => [g, DEFAULT_PERIOD])));
        setSeriesCache({ [DEFAULT_PERIOD]: data.series });
        setPageState("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMessage(err instanceof ApiError ? err.message : "지표를 불러오지 못함.");
        setPageState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handlePeriodChange(group: string, period: AdminMetricsPeriod) {
    setPeriodByGroup((prev) => ({ ...prev, [group]: period }));
    if (seriesCache[period]) return; // 이미 불러온 기간이면 재요청 안 함

    const key = `${group}:${period}`;
    setLoadingKeys((prev) => new Set(prev).add(key));
    fetchAdminDashboard(period)
      .then((data) => {
        setSeriesCache((prev) => ({ ...prev, [period]: data.series }));
      })
      .catch(() => {
        // 카드까지 에러 상태로 만들 필요는 없음 - 이 차트만 "데이터 없음"으로 남는다.
      })
      .finally(() => {
        setLoadingKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      });
  }

  const chartsByGroup = useMemo(
    () =>
      groups.map((group) => {
        const period = periodByGroup[group] ?? DEFAULT_PERIOD;
        const series = (seriesCache[period] ?? []).filter((s) => s.group === group);
        return { group, period, series, combined: buildCombinedSeries(series) };
      }),
    [groups, periodByGroup, seriesCache],
  );

  return (
    <main className="main-content flex bg-neutral">
      <AdminSidebar />

      <div className="min-w-0 flex-1 px-9 py-8">
        <h1 className="mb-1 mt-0 text-2xl font-extrabold tracking-[-0.5px]">운영 현황 대시보드</h1>
        <p className="mb-[22px] text-[13.5px] text-[#8A8A92]">
          서비스에 계측된 지표로 운영 현황을 확인함
        </p>

        {pageState === "loading" && (
          <div className="flex h-[200px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#E7E7EB] border-t-primary" />
          </div>
        )}

        {pageState === "error" && (
          <div className="rounded-2xl border border-[#F6C6C6] bg-[#FFF1F1] px-5 py-4 text-[13.5px] font-semibold text-[#C21414]">
            {errorMessage}
          </div>
        )}

        {pageState === "ready" && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {cards.map((card) => (
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

            {chartsByGroup.map(({ group, period, series, combined }) => {
              const isLoading = loadingKeys.has(`${group}:${period}`);
              return (
                <div key={group} className="mt-3 rounded-2xl border border-[#EDEDF0] bg-white p-6">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-[15px] font-extrabold">
                      {GROUP_TITLES[group] ?? series[0]?.label}
                    </h2>
                    <div className="flex gap-1.5">
                      {PERIODS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => handlePeriodChange(group, p)}
                          className={`rounded-full px-3 py-1 text-[11.5px] font-bold transition ${
                            period === p
                              ? "bg-primary text-white"
                              : "bg-white text-[#8A8A92] hover:text-primary"
                          } border border-[#EDEDF0]`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {isLoading ? (
                    <div className="flex h-[300px] items-center justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-[#E7E7EB] border-t-primary" />
                    </div>
                  ) : combined.points.length === 0 ? (
                    <div className="flex h-[300px] items-center justify-center text-[13.5px] text-[#9A9AA2]">
                      아직 데이터 없음.
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
              );
            })}
          </>
        )}
      </div>
    </main>
  );
}
