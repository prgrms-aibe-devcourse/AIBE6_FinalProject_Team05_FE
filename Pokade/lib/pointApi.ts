import { apiPost } from "@/lib/apiClient";
import { PointChargeConfirmResponse, PointChargeReadyResponse } from "@/types/point";

// POST /api/points/charge/ready — 결제창을 띄우기 전에 주문을 먼저 만든다. 로그인 필요.
export async function readyPointCharge(amount: number): Promise<PointChargeReadyResponse> {
  return apiPost<PointChargeReadyResponse>("/api/points/charge/ready", { amount });
}

// POST /api/points/charge/confirm — 토스 결제창 successUrl 리다이렉트 쿼리(paymentKey/orderId/amount)를
// 그대로 전달한다. 로그인 필요.
export async function confirmPointCharge(
  paymentKey: string,
  orderId: string,
  amount: number,
): Promise<PointChargeConfirmResponse> {
  return apiPost<PointChargeConfirmResponse>("/api/points/charge/confirm", { paymentKey, orderId, amount });
}
