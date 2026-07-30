import type { Metadata } from "next";
import { fetchCardDetail } from "@/lib/cardApi";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const card = await fetchCardDetail(Number(id));
    return { title: `${card.name} - PocketTrade` };
  } catch {
    return { title: "Card Detail - PocketTrade" };
  }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
