import type { Metadata } from "next";
import { Exo, Manrope, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClientInstrumentation } from "@/components/telemetry/ClientInstrumentation";
import { TelemetryErrorReporter } from "@/components/telemetry/TelemetryErrorReporter";
import { TelemetryPageView } from "@/components/telemetry/TelemetryPageView";
import Script from "next/script";
import "./globals.css";

const googleAnalyticsId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

const exo = Exo({
  variable: "--font-exo",
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Arena Digital - Gestão de Arenas",
  description: "Sistema de gestão para arenas esportivas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${exo.variable} ${manrope.variable} ${manrope.className} ${geistMono.variable} antialiased`}
      >
        {googleAnalyticsId && <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`}
          strategy="afterInteractive"
        />}
        {googleAnalyticsId && <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', ${JSON.stringify(googleAnalyticsId)});
          `}
        </Script>}
        <ClientInstrumentation />
        <TelemetryPageView />
        <TelemetryErrorReporter />
        <TooltipProvider>
          {children}
        </TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
