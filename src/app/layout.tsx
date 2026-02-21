import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { AiProvider } from "@/components/ai-provider";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-manrope",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: "Glyte — The Dashboard That Builds Itself",
  description:
    "Open-source AI analytics. Upload CSV, get instant dashboard. Free forever.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Glyte — The Dashboard That Builds Itself",
    description:
      "Open-source AI analytics. Upload CSV, get instant dashboard. Free forever.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${manrope.variable} ${spaceGrotesk.variable}`}>
      <body className={`${manrope.className} antialiased`}>
        <AiProvider>
          {children}
        </AiProvider>
      </body>
    </html>
  );
}
