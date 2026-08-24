import type { Metadata } from "next";
import { fetchCardDetail } from "@/lib/cardApi";
import { parseCardId } from "@/types/card";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const cardId = parseCardId(id);
  if (cardId == null) return { title: "Card Detail - Pokade" };
  try {
    const card = await fetchCardDetail(cardId);
    return { title: `${card.nameKo ?? card.name} - Pokade` };
  } catch {
    return { title: "Card Detail - Pokade" };
  }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
