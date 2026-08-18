// com.pokade.domain.admin.metrics.AdminMetricsPeriod 미러링 - 차트(시리즈) 조회 단위.
export type AdminMetricsPeriod = "10m" | "1h" | "1d";

// GET /api/admin/metrics/dashboard 응답 — com.pokade.domain.admin.metrics.dto.AdminDashboardResponse 미러링.
// Prometheus/Grafana는 이 데이터의 원본일 뿐 FE는 항상 이 타입으로만 받는다(Grafana 미임베드).
export interface AdminMetricCardResponse {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  subLabel: string | null;
  subValue: number | null;
}

export interface AdminMetricSeriesPoint {
  epochSeconds: number;
  value: number;
}

// group: 같은 group끼리는 스케일이 맞아 한 차트에 겹쳐 그릴 수 있다(BE가 정해서 내려줌).
export interface AdminMetricSeriesResponse {
  key: string;
  label: string;
  unit: string;
  group: string;
  points: AdminMetricSeriesPoint[];
}

export interface AdminDashboardResponse {
  cards: AdminMetricCardResponse[];
  series: AdminMetricSeriesResponse[];
}
