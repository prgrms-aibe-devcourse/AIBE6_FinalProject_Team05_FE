import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AuthInitializer from "@/components/AuthInitializer";
import ChatWidget from "@/components/ChatWidget";

export const metadata: Metadata = {
  title: "PocketTrade",
  description: "Retro-Grade Trading Card Marketplace",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <AuthInitializer />
        <div className="page-container">
          <Header />
          {children}
          <Footer />
        </div>
        <ChatWidget />
      </body>
    </html>
  );
}
