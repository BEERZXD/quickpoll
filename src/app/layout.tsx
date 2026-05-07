import type { Metadata } from "next";
import { Geist_Mono, Noto_Sans_Thai } from "next/font/google";
import { appCopy } from "@/lib/copy";
import { SiteFooter } from "./SiteFooter";
import "./globals.css";

const thaiSans = Noto_Sans_Thai({
  variable: "--font-thai-sans",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: appCopy.metadata.title,
  description: appCopy.metadata.description,
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={appCopy.language} className={`${thaiSans.variable} ${geistMono.variable}`}>
      <body>
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
