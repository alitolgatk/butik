import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { BottomNav } from "@/components/bottom-nav";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Başak Butik",
  description: "Kadın giyim butik satış yönetim sistemi",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={cn("font-sans", inter.variable)}>
      <body className="min-h-screen antialiased">
        <main className="mx-auto max-w-lg pb-20">{children}</main>
        <BottomNav />
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
