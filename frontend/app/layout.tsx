import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "EmotionSense — Real-time emotion intelligence for text",
    template: "%s · EmotionSense",
  },
  description:
    "Paste any sentence and see which of six emotions it expresses, with a full confidence breakdown. Powered by DistilBERT fine-tuned on 16,000 labelled examples.",
  keywords: [
    "emotion detection",
    "sentiment analysis",
    "text classification",
    "DistilBERT",
    "NLP",
    "machine learning",
  ],
  authors: [{ name: "EmotionSense" }],
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "EmotionSense",
    title: "EmotionSense — Real-time emotion intelligence for text",
    description:
      "Six emotions, scored in milliseconds. A DistilBERT classifier with a full confidence breakdown for every sentence.",
  },
  twitter: {
    card: "summary_large_image",
    title: "EmotionSense — Real-time emotion intelligence for text",
    description: "Six emotions, scored in milliseconds, with a full confidence breakdown.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0F" },
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} ${inter.variable}`}
    >
      <body className="min-h-dvh">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <TooltipProvider delayDuration={200}>
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-canvas"
            >
              Skip to content
            </a>
            <div className="flex min-h-dvh flex-col">
              <SiteHeader />
              <main id="main" className="flex-1">
                {children}
              </main>
              <SiteFooter />
            </div>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
