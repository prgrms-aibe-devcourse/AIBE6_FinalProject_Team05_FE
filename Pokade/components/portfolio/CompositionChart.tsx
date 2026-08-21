import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import PokeballIcon from "@/components/portfolio/PokeballIcon";
import { PortfolioAnalyticsItemResponse } from "@/types/portfolio";

// 구성비율 파이차트 색상 — 항목 수가 팔레트보다 많으면 순환한다.
const CHART_COLORS = ["#EE1515", "#3B4CCA", "#FFCB05", "#16A34A", "#8B5CF6", "#F97316", "#9CA3AF"];

export default function CompositionChart({
  title,
  data,
}: {
  title: string;
  data: PortfolioAnalyticsItemResponse[];
}) {
  return (
    <div className="w-full rounded-lg border border-[#EDEDF0] bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <PokeballIcon className="h-4 w-4" />
        <h3 className="text-[14px] font-bold text-[#4B4B52]">{title}</h3>
      </div>
      {data.length === 0 ? (
        <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-[13px] text-[#9A9AA2]">
          <PokeballIcon muted className="h-16 w-16 text-[#E3E3EC]" />
          아직 계산할 시세 데이터가 없어요
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              dataKey="ratio"
              nameKey="label"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
            >
              {data.map((entry, i) => (
                <Cell key={entry.label} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => `${Number(value).toFixed(2)}%`} />
            <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
