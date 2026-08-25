import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AuthInitializer from "@/components/AuthInitializer";
import ChatWidget from "@/components/ChatWidget";
import VisitTracker from "@/components/VisitTracker";

export const metadata: Metadata = {
  title: "Pokade - 믿을 수 있는 포켓몬 카드 거래",
  description: "Retro-Grade Trading Card Marketplace",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <AuthInitializer />
        <VisitTracker />
        <div className="page-container">
          <Header />
          {children}
          <ChatWidget />
          <Footer />
        </div>
      </body>
    </html>
  );
}
