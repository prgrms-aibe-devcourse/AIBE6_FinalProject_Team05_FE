"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
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
import { ChartPeriod, TradeSummaryResponse } from "@/types/price";
import { loginUrlFor } from "@/lib/authRedirect";

// 등급별 고정 색상 — S/A/B는 GradeBadge/ListingGradeBadge와 톤을 맞추고,
// PSA/미등급(RAW)은 겹치지 않는 색을 새로 배정한다.
const GRADE_COLORS: Record<string, string> = {
  RAW: "#8A8A92",
  S: "#FFCB05",
  A: "#3B4CCA",
  B: "#9CA3AF",
  PSA10: "#16A34A",
  PSA9: "#F97316",
  PSA8: "#8B5CF6",
};

const GRADE_LABELS: Record<string, string> = {
  RAW: "미등급",
  PSA10: "PSA 10",
  PSA9: "PSA 9",
  PSA8: "PSA 8",
};

// 전체 보기(등급 섞어서) 탭의 내부 키 — 실제 등급 값과 겹치지 않도록 별도 상수로 관리.
const ALL_GRADES = "ALL";

// 탭 표시 순서 고정용(값이 없는 등급은 데이터에 없으면 애초에 노출 안 됨).
const GRADE_ORDER = ["RAW", "S", "A", "B", "PSA10", "PSA9", "PSA8"];

const PERIODS: { value: ChartPeriod; label: string }[] = [
  { value: "7d", label: "7일" },
  { value: "30d", label: "30일" },
  { value: "90d", label: "90일" },
  { value: "180d", label: "180일" },
];

function formatAxisDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatTooltipDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

type ChartPoint = { tradedAt: string; [grade: string]: string | number };

// 가격 규모에 따른 눈금의 "최소 단위" — 100만원대 카드는 최소 10만원 단위, 10만원대는 최소
// 1만원 단위처럼 더 저렴한 카드일수록 더 잘게 쪼개서, 4,773,000 같은 지저분한 눈금을 막는다.
function magnitudeFloor(value: number): number {
  if (value >= 1_000_000) return 100_000;
  if (value >= 100_000) return 10_000;
  if (value >= 10_000) return 1_000;
  if (value >= 1_000) return 100;
  if (value >= 100) return 10;
  return 1;
}

// magnitudeFloor 배수 중 1/2/5/10배 계열로 "보기 좋은" 값을 골라, 눈금 개수를 idealTicks
// 근처로 유지하면서도 항상 최소 단위(floor)의 배수가 되도록 한다.
function niceStep(range: number, floor: number, idealTicks: number): number {
  const raw = Math.max(range / idealTicks, floor);
  const multiple = raw / floor;
  const niceMultiple =
    multiple <= 1
      ? 1
      : multiple <= 2
        ? 2
        : multiple <= 5
          ? 5
          : multiple <= 10
            ? 10
            : Math.ceil(multiple / 10) * 10;
  return niceMultiple * floor;
}

// [min, max]에 여백을 주고 niceStep 배수로 스냅해서, 도메인 경계와 눈금이 항상 깔끔한 값
// (예: 1,500,000/2,000,000/2,500,000...)이 되도록 한다.
function computeNiceAxis(
  values: number[],
  paddingRatio: number,
  idealTicks = 5,
): { domain: [number, number]; ticks: number[] } {
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const pad =
    rawMin === rawMax ? Math.max(rawMin * paddingRatio, 1) : (rawMax - rawMin) * paddingRatio;
  const paddedMin = Math.max(0, rawMin - pad);
  const paddedMax = rawMax + pad;

  const floor = magnitudeFloor(paddedMax);
  const step = niceStep(paddedMax - paddedMin, floor, idealTicks);
  const niceMin = Math.floor(paddedMin / step) * step;
  const niceMax = Math.ceil(paddedMax / step) * step;

  const ticks: number[] = [];
  for (let v = niceMin; v <= niceMax + step * 1e-6; v += step) {
    ticks.push(Math.round(v));
  }
  return { domain: [niceMin, niceMax], ticks };
}

// BE가 grade별로 묶어주지 않고 flat하게 내려주므로(팀 결정), 등급을 컬럼으로 펼쳐
// recharts가 등급별 Line을 따로 그릴 수 있는 형태로 변환한다.
// 같은 날짜(일 단위)의 포인트는 등급이 달라도 한 행으로 합친다 — 합치지 않으면 카테고리형 X축에서
// 등급마다 미세하게(밀리초 단위) 다른 타임스탬프가 서로 다른 칸으로 갈라져, 마우스를 올렸을 때
// 옆 칸(다른 등급)의 값이 툴팁에 뜨는 문제가 생긴다. grade-chart 보완 데이터처럼 등급별로 API를
// 따로 호출해 "지금"/"N일 전"이 호출마다 몇 ms씩 다르게 찍히는 경우 특히 두드러진다.
function buildChartData(trades: TradeSummaryResponse[]): {
  points: ChartPoint[];
  grades: string[];
} {
  const gradeSet = new Set<string>();
  const byDay = new Map<string, ChartPoint>();

  for (const t of trades) {
    const gradeKey = t.grade ?? "RAW";
    gradeSet.add(gradeKey);
    const dayKey = t.tradedAt.slice(0, 10);
    const existing = byDay.get(dayKey);
    if (existing) {
      existing[gradeKey] = t.price;
    } else {
      byDay.set(dayKey, { tradedAt: t.tradedAt, [gradeKey]: t.price });
    }
  }

  const points = Array.from(byDay.values()).sort(
    (a, b) => new Date(a.tradedAt).getTime() - new Date(b.tradedAt).getTime(),
  );
  const grades = Array.from(gradeSet).sort(
    (a, b) => GRADE_ORDER.indexOf(a) - GRADE_ORDER.indexOf(b),
  );
  return { points, grades };
}

export default function PriceChart({
  data,
  period,
  onPeriodChange,
  loading,
  locked = false,
}: {
  data: TradeSummaryResponse[];
  period: ChartPeriod;
  onPeriodChange: (period: ChartPeriod) => void;
  loading: boolean;
  locked?: boolean;
}) {
  const { points, grades } = buildChartData(data);
  const [selectedGrade, setSelectedGrade] = useState<string>(ALL_GRADES);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const loginHref = loginUrlFor(pathname, searchParams);

  // 기간을 바꿔서 선택 중이던 등급의 거래가 더 이상 없으면(예: 30일→해당 등급 거래 없음)
  // 조용히 "전체"로 되돌린다 — 존재하지 않는 등급 탭이 선택된 채로 남지 않도록.
  const activeGrade = grades.includes(selectedGrade) ? selectedGrade : ALL_GRADES;
  const isSingleGrade = activeGrade !== ALL_GRADES;

  // 단일 등급 보기: 다른 등급 컬럼이 섞이지 않은 전용 포인트 배열 + 그 등급만의 min/max로
  // Y축을 확대해서 변동폭이 실제보다 눌려 보이지 않게 한다("전체" 보기는 등급 간 가격대 차이가
  // 커서 공유 축을 쓰면 어차피 한쪽이 눌려 보이므로, 이 확대는 단일 등급 보기에서만 의미가 있다).
  const singlePoints = useMemo((): { tradedAt: string; price: number }[] => {
    if (!isSingleGrade) return [];
    return data
      .filter((t) => (t.grade ?? "RAW") === activeGrade)
      .map((t) => ({ tradedAt: t.tradedAt, price: t.price }));
  }, [data, activeGrade, isSingleGrade]);

  // 단일 등급: 위아래 15% 여백만 남겨 변동폭을 강조. 전체 보기: 등급이 섞여 있으니
  // 강조 목적의 여백 없이(가벼운 8%만) 실제 가격대를 그대로 보여준다.
  // 두 경우 다 niceStep으로 스냅해서 눈금이 항상 깔끔한 값(예: 4,700,000)이 되게 한다.
  const yAxis = useMemo(() => {
    const values = isSingleGrade
      ? singlePoints.map((p) => p.price)
      : points.flatMap((p) =>
          grades.map((g) => p[g]).filter((v): v is number => typeof v === "number"),
        );
    if (values.length === 0) return undefined;
    return computeNiceAxis(values, isSingleGrade ? 0.15 : 0.08);
  }, [isSingleGrade, singlePoints, points, grades]);

  // 단일 등급 보기에서만 의미가 있다 - singlePoints는 이미 오래된순으로 오므로 첫/마지막 포인트로
  // "선택 기간 동안" 등락(금액+퍼센트)을 구한다(전체 보기는 등급마다 가격대가 달라 하나로 뭉뚱그릴 수 없다).
  const priceChange = useMemo(() => {
    if (!isSingleGrade || singlePoints.length < 2) return null;
    const first = singlePoints[0].price;
    const last = singlePoints[singlePoints.length - 1].price;
    if (first === 0) return null;
    return { amount: last - first, rate: ((last - first) / first) * 100 };
  }, [isSingleGrade, singlePoints]);

  // 등급 탭에 방향 화살표를 붙이기 위해, 선택 여부와 무관하게 등급별 등락률을 전부 미리 계산한다
  // (계산 방식은 changeRate와 동일 - data는 이미 오래된순이라 필터링만으로 첫/마지막 포인트를 구한다).
  const changeRateByGrade = useMemo(() => {
    const byGrade = new Map<string, number[]>();
    for (const t of data) {
      const g = t.grade ?? "RAW";
      const list = byGrade.get(g) ?? [];
      list.push(t.price);
      byGrade.set(g, list);
    }
    const result: Record<string, number> = {};
    for (const [grade, prices] of byGrade) {
      if (prices.length < 2 || prices[0] === 0) continue;
      result[grade] = ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100;
    }
    return result;
  }, [data]);

  const chartData = isSingleGrade ? singlePoints : points;
  const isEmpty = chartData.length === 0;

  return (
    <div className="rounded-2xl border border-[#EDEDF0] bg-white p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[17px] font-extrabold">시세 차트</h2>
        <div className="flex gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => onPeriodChange(p.value)}
              className={`rounded-full px-3 py-1 text-[12px] font-bold transition ${
                period === p.value
                  ? "bg-primary text-white"
                  : "bg-neutral text-[#8A8A92] hover:text-primary"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {!loading && !locked && grades.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedGrade(ALL_GRADES)}
            className={`rounded-full px-2.5 py-1 text-[11.5px] font-bold transition ${
              activeGrade === ALL_GRADES
                ? "bg-ink text-white"
                : "bg-neutral text-[#8A8A92] hover:text-ink"
            }`}
          >
            전체
          </button>
          {grades.map((grade) => {
            const isActive = activeGrade === grade;
            const rate = changeRateByGrade[grade];
            return (
              <button
                key={grade}
                type="button"
                onClick={() => setSelectedGrade(grade)}
                className={`rounded-full px-2.5 py-1 text-[11.5px] font-bold transition ${
                  isActive
                    ? grade === "S"
                      ? "text-grade-s-ink"
                      : "text-white"
                    : "bg-neutral text-[#8A8A92] hover:text-ink"
                }`}
                style={isActive ? { backgroundColor: GRADE_COLORS[grade] } : undefined}
              >
                {GRADE_LABELS[grade] ?? grade}
                {rate !== undefined && (
                  <span
                    className={`ml-1 ${
                      isActive ? "" : rate > 0 ? "text-[#EE1515]" : rate < 0 ? "text-[#2D5BFF]" : ""
                    }`}
                  >
                    {rate > 0 ? "▲" : rate < 0 ? "▼" : ""}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {!loading && !locked && isSingleGrade && priceChange !== null && (
        <div className="mb-4 -mt-1.5 flex items-center gap-1.5">
          <span className="text-[11.5px] font-semibold text-[#9A9AA2]">
            {PERIODS.find((p) => p.value === period)?.label} 등락
          </span>
          <span
            className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${
              priceChange.rate > 0
                ? "bg-[#FFF1F1] text-[#EE1515]"
                : priceChange.rate < 0
                  ? "bg-[#EEF3FF] text-[#2D5BFF]"
                  : "bg-neutral text-[#8A8A92]"
            }`}
          >
            {priceChange.rate > 0 ? "▲" : priceChange.rate < 0 ? "▼" : "-"}{" "}
            {Math.abs(priceChange.amount).toLocaleString("ko-KR")}원 ({Math.abs(priceChange.rate).toFixed(2)}%)
          </span>
        </div>
      )}

      {loading && (
        <div className="flex h-[320px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#E7E7EB] border-t-primary" />
        </div>
      )}

      {!loading && locked && (
        <div className="relative h-[320px] overflow-hidden rounded-xl">
          <div className="h-full w-full bg-[#F2F2F5] blur-[2px]" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-white/25">
            <span className="whitespace-nowrap text-[13px] font-bold text-ink">
              시세 차트는 로그인 후 확인할 수 있습니다.
            </span>
            <Link
              href={loginHref}
              className="rounded-[9px] border-2 border-primary-dark bg-primary px-4 py-2 text-[12.5px] font-bold text-white shadow-tactile hover:brightness-105"
            >
              로그인하기
            </Link>
          </div>
        </div>
      )}

      {!loading && !locked && isEmpty && (
        <div className="flex h-[320px] items-center justify-center text-[13.5px] text-[#9A9AA2]">
          해당 기간에 체결된 거래가 없습니다.
        </div>
      )}

      {!loading && !locked && !isEmpty && (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EDEDF0" />
            <XAxis
              dataKey="tradedAt"
              tickFormatter={formatAxisDate}
              tick={{ fontSize: 10.5, fill: "#8A8A92" }}
              axisLine={{ stroke: "#EDEDF0" }}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              domain={yAxis?.domain}
              ticks={yAxis?.ticks}
              tickFormatter={(v: number) => v.toLocaleString("ko-KR")}
              tick={{ fontSize: 10.5, fill: "#8A8A92" }}
              axisLine={{ stroke: "#EDEDF0" }}
              tickLine={false}
              width={68}
              allowDecimals={false}
            />
            <Tooltip
              labelFormatter={(label) => formatTooltipDate(String(label))}
              formatter={(value, name) => [
                `${Number(value).toLocaleString("ko-KR")}원`,
                GRADE_LABELS[String(name)] ?? String(name),
              ]}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #EDEDF0",
                fontSize: 12.5,
              }}
            />
            {!isSingleGrade && (
              <Legend
                formatter={(value: string) => GRADE_LABELS[value] ?? value}
                wrapperStyle={{ fontSize: 12, fontWeight: 700 }}
              />
            )}
            {isSingleGrade ? (
              <Line
                type="monotone"
                dataKey="price"
                stroke={GRADE_COLORS[activeGrade] ?? "#8A8A92"}
                strokeWidth={2}
                dot={{ r: 3 }}
                name={activeGrade}
              />
            ) : (
              grades.map((grade) => (
                <Line
                  key={grade}
                  type="monotone"
                  dataKey={grade}
                  stroke={GRADE_COLORS[grade] ?? "#8A8A92"}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                  name={grade}
                />
              ))
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
