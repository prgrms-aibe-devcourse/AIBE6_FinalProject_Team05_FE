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

export interface AdminMetricSeriesResponse {
  key: string;
  label: string;
  unit: string;
  points: AdminMetricSeriesPoint[];
}

export interface AdminDashboardResponse {
  cards: AdminMetricCardResponse[];
  series: AdminMetricSeriesResponse[];
}
