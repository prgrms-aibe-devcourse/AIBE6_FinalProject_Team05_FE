"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DailyMarketStatResponse } from "@/types/price";

const VOLUME_COLOR = "#A5B4FC";
const AVG_COLOR = "#EE1515";

// "YYYY-MM-DD" 문자열을 직접 분해해서 파싱한다 - new Date(iso)는 이 형식을 UTC 자정으로 해석하는데
// getMonth()/getDate() 같은 로컬 게터와 섞어 쓰면 UTC보다 offset이 음수인 타임존에서 하루 밀린다.
function parseDateParts(iso: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function formatAxisDate(iso: string) {
  const parts = parseDateParts(iso);
  if (!parts) return iso;
  return `${parts.month}/${parts.day}`;
}

function formatTooltipDate(iso: string) {
  const parts = parseDateParts(iso);
  if (!parts) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parts.year}.${pad(parts.month)}.${pad(parts.day)}`;
}

// changeRate가 null이면(비교 대상 시점에 체결이 없어 비교 불가) 배지 자체를 숨긴다 - 0%처럼 보이는 거짓 신호 방지.
function ChangeBadge({ label, rate }: { label: string; rate: number | null }) {
  if (rate === null) {
    return (
      <span className="text-[12px] font-semibold text-[#B4B4BC]">
        {label} -
      </span>
    );
  }
  const isRise = rate > 0;
  const isFlat = rate === 0;
  const cls = isFlat ? "text-[#9A9AA2]" : isRise ? "text-primary" : "text-secondary";
  return (
    <span className={`text-[12.5px] font-bold ${cls}`}>
      {isFlat ? "-" : isRise ? "▲" : "▼"} {Math.abs(rate).toFixed(2)}%
      <span className="ml-1 font-semibold text-[#9A9AA2]">{label}</span>
    </span>
  );
}

// 전일 대비 변동 - 비율뿐 아니라 실제 값(원/건)도 같이 보여준다(사용자 요청). rate가 없어도
// amount는 그대로 보여준다(예: 거래량은 어제가 0건이면 rate는 null이지만 amount는 항상 있음).
function AmountChangeBadge({ label, amount, rate, unit }: { label: string; amount: number | null; rate: number | null; unit: string }) {
  if (amount === null) {
    return (
      <span className="text-[12px] font-semibold text-[#B4B4BC]">
        {label} -
      </span>
    );
  }
  const isRise = amount > 0;
  const isFlat = amount === 0;
  const cls = isFlat ? "text-[#9A9AA2]" : isRise ? "text-primary" : "text-secondary";
  return (
    <span className={`text-[12.5px] font-bold ${cls}`}>
      {isFlat ? "-" : isRise ? "▲" : "▼"} {Math.abs(amount).toLocaleString("ko-KR")}
      {unit}
      {rate !== null && (
        <> ({isFlat ? "" : isRise ? "+" : "-"}{Math.abs(rate).toFixed(2)}%)</>
      )}
      <span className="ml-1 font-semibold text-[#9A9AA2]">{label}</span>
    </span>
  );
}

export default function MarketOverviewChart({
  todayVolume,
  volumeChangeRate,
  volumeChangeAmount,
  todayAvgPrice,
  avgChangeRate1d,
  avgChangeAmount1d,
  avgChangeRate7d,
  avgChangeRate30d,
  totalVolume,
  dailyStats,
  loading,
}: {
  todayVolume: number;
  volumeChangeRate: number | null;
  volumeChangeAmount: number;
  todayAvgPrice: number | null;
  avgChangeRate1d: number | null;
  avgChangeAmount1d: number | null;
  avgChangeRate7d: number | null;
  avgChangeRate30d: number | null;
  totalVolume: number;
  dailyStats: DailyMarketStatResponse[];
  loading: boolean;
}) {
  const isEmpty = dailyStats.every((d) => d.volume === 0);

  return (
    <div className="rounded-2xl border border-[#EDEDF0] bg-white p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-[17px] font-extrabold">거래 현황</h2>
        <span className="text-[12px] font-semibold text-[#9A9AA2]">최근 30일</span>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-[#FAFAFB] px-4 py-3.5">
          <div className="text-[11.5px] font-semibold text-[#9A9AA2]">오늘 거래량</div>
          <div className="mt-1 text-[19px] font-extrabold">
            {loading ? "-" : `${todayVolume.toLocaleString("ko-KR")}건`}
          </div>
          <div className="mt-1">
            {loading ? (
              <span className="text-[12px] font-semibold text-[#B4B4BC]">전일 대비 -</span>
            ) : (
              <AmountChangeBadge label="전일 대비" amount={volumeChangeAmount} rate={volumeChangeRate} unit="건" />
            )}
          </div>
        </div>
        <div className="rounded-xl bg-[#FAFAFB] px-4 py-3.5">
          <div className="text-[11.5px] font-semibold text-[#9A9AA2]">오늘 거래가 평균</div>
          <div className="mt-1 text-[19px] font-extrabold">
            {loading ? "-" : todayAvgPrice !== null ? `${todayAvgPrice.toLocaleString("ko-KR")}원` : "-"}
          </div>
          <div className="mt-1">
            {loading ? (
              <span className="text-[12px] font-semibold text-[#B4B4BC]">전일 대비 -</span>
            ) : (
              <AmountChangeBadge label="전일 대비" amount={avgChangeAmount1d} rate={avgChangeRate1d} unit="원" />
            )}
          </div>
        </div>
        <div className="rounded-xl bg-[#FAFAFB] px-4 py-3.5">
          <div className="text-[11.5px] font-semibold text-[#9A9AA2]">최근 30일 총 거래량</div>
          <div className="mt-1 text-[19px] font-extrabold">
            {loading ? "-" : `${totalVolume.toLocaleString("ko-KR")}건`}
          </div>
          <div className="mt-1 text-[12px] font-semibold text-[#9A9AA2]">
            {loading ? "-" : `오늘 ${todayVolume.toLocaleString("ko-KR")}건`}
          </div>
        </div>
      </div>

      {/* 거래가 평균의 1주일 전/30일 전 대비 변화율 - 전일 대비는 위 카드에서 금액과 함께 이미 보여주므로
          여기서는 더 긴 기준선 두 개만 보여준다. */}
      <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-[#FAFAFB] px-4 py-3">
        <span className="text-[11.5px] font-semibold text-[#9A9AA2]">거래가 평균 변동</span>
        {loading ? (
          <>
            <span className="text-[12px] font-semibold text-[#B4B4BC]">1주일 전 대비 -</span>
            <span className="text-[12px] font-semibold text-[#B4B4BC]">30일 전 대비 -</span>
          </>
        ) : (
          <>
            <ChangeBadge label="1주일 전 대비" rate={avgChangeRate7d} />
            <ChangeBadge label="30일 전 대비" rate={avgChangeRate30d} />
          </>
        )}
      </div>

      {loading && (
        <div className="flex h-[280px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#E7E7EB] border-t-primary" />
        </div>
      )}

      {!loading && isEmpty && (
        <div className="flex h-[280px] items-center justify-center text-[13.5px] text-[#9A9AA2]">
          최근 30일간 체결된 거래가 없습니다.
        </div>
      )}

      {!loading && !isEmpty && (
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={dailyStats} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EDEDF0" />
            <XAxis
              dataKey="date"
              tickFormatter={formatAxisDate}
              tick={{ fontSize: 10.5, fill: "#8A8A92" }}
              axisLine={{ stroke: "#EDEDF0" }}
              tickLine={false}
              minTickGap={20}
            />
            <YAxis
              yAxisId="volume"
              tick={{ fontSize: 10.5, fill: "#8A8A92" }}
              axisLine={{ stroke: "#EDEDF0" }}
              tickLine={false}
              width={36}
              allowDecimals={false}
            />
            <YAxis
              yAxisId="avg"
              orientation="right"
              tick={{ fontSize: 10.5, fill: "#8A8A92" }}
              axisLine={{ stroke: "#EDEDF0" }}
              tickLine={false}
              width={64}
              tickFormatter={(v: number) => v.toLocaleString("ko-KR")}
              domain={["auto", "auto"]}
            />
            <Tooltip
              labelFormatter={(label) => formatTooltipDate(String(label))}
              formatter={(value, _name, item) => {
                if (item?.dataKey === "volume") return [`${Number(value).toLocaleString("ko-KR")}건`, "거래량"];
                return [`${Number(value).toLocaleString("ko-KR")}원`, "거래가 평균"];
              }}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #EDEDF0",
                fontSize: 12.5,
              }}
            />
            <Bar
              yAxisId="volume"
              dataKey="volume"
              name="거래량"
              fill={VOLUME_COLOR}
              radius={[4, 4, 0, 0]}
              barSize={10}
            />
            <Line
              yAxisId="avg"
              type="monotone"
              dataKey="avgPrice"
              name="거래가 평균"
              stroke={AVG_COLOR}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            {/* 막대=거래량(왼쪽 축), 선=거래가 평균(오른쪽 축)임을 알려주는 범례 - 두 지표가 서로
                다른 축 스케일을 쓰기 때문에 범례 없이는 어떤 색이 뭘 뜻하는지 헷갈리기 쉽다.
                iconType을 따로 안 주면 recharts가 Bar는 사각형, Line은 선 아이콘으로 각자 실제
                그려진 모양대로 자동 표시한다. */}
            <Legend
              verticalAlign="bottom"
              align="left"
              wrapperStyle={{ fontSize: 12, fontWeight: 700, paddingTop: 12 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
