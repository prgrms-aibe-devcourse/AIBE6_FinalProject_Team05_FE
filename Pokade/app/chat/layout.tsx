import type { Metadata } from "next";
export const metadata: Metadata = { title: "Chat - Pokade" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
