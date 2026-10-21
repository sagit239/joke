import type { Metadata, Viewport } from "next";
import { messages } from "@/lib/messages";
import "./globals.css";

export const metadata: Metadata = {
  title: messages.title,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
