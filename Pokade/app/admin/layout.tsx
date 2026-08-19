import AdminGuard from "@/components/AdminGuard";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminGuard>{children}</AdminGuard>;
}
