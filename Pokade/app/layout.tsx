import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "PocketTrade",
  description: "Retro-Grade Trading Card Marketplace",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        {/* Header/Footer are rendered once here — pages return only their <main>. */}
        <div className="page-container">
          <Header />
          {children}
          <Footer />
        </div>
      </body>
    </html>
  );
}
