import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { AiProvider } from "@/components/ai-provider";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "Glyte — Analytics Dashboard",
  description: "Upload CSV, get instant analytics dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={manrope.variable}>
      <body className={`${manrope.className} antialiased`}>
        <AiProvider>
          {children}
        </AiProvider>
      </body>
    </html>
  );
}
