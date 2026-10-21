import type { Metadata, Viewport } from "next";
import { Heebo, Rubik } from "next/font/google";
import { messages } from "@/lib/messages";
import "./globals.css";

// Self-hosted at build time by next/font: the browser never contacts Google.
const rubik = Rubik({
  subsets: ["hebrew", "latin"],
  weight: ["700"],
  variable: "--font-rubik",
  display: "swap",
});

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["400", "600"],
  variable: "--font-heebo",
  display: "swap",
});

export const metadata: Metadata = {
  title: messages.title,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${rubik.variable} ${heebo.variable}`}>
      <body>{children}</body>
    </html>
  );
}
