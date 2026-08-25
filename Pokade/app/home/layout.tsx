import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Pokade",
  description: "Retro-Grade Trading Card Marketplace",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
