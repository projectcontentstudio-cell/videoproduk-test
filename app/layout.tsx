import type { Metadata } from "next";
import { AuthGate } from "@/components/AuthGate";
import "./globals.css";

export const metadata: Metadata = {
  title: "VideoProduk.my",
  description: "Jana video TikTok produk dalam Bahasa Melayu."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ms">
      <body className="font-sans antialiased">
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
