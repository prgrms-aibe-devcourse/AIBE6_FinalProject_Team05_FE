import type { Metadata } from "next";
import GuestGuard from "@/components/GuestGuard";
export const metadata: Metadata = { title: "Login - Pokade" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <GuestGuard>{children}</GuestGuard>;
}
