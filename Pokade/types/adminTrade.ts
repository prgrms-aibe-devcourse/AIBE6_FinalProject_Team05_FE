import { ListingGrade } from "@/types/price";
import { TradeStatus } from "@/types/trade";

// GET /api/admin/trades, GET /api/admin/trades/{id} 응답 —
// com.pokade.domain.admin.dto.response.AdminTradeResponse 미러링.
// 일반 TradeResponse에 판매자/구매자 닉네임이 추가된 관리자 전용 형태 - #1/#3 같은 id 대신
// 화면에 닉네임을 보여주기 위함.
export interface AdminTradeResponse {
  id: number;
  listingId: number;
  buyerId: number;
  buyerNickname: string | null;
  sellerId: number;
  sellerNickname: string | null;
  cardId: number;
  cardName: string | null;
  cardNameKo: string | null;
  cardImageUrl: string | null;
  grade: ListingGrade | null;
  price: number;
  status: TradeStatus;
  shippedAt: string | null;
  inspectedAt: string | null;
  deliveredAt: string | null;
  confirmedAt: string | null;
  settledAt: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  recipientAddress: string | null;
  createdAt: string;
  pointsUsed: number | null;
}
