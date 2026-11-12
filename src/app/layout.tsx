import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, Manrope } from "next/font/google";
import { cookies } from "next/headers";
import { Toaster } from "sonner";
import { I18nProvider } from "@/lib/i18n/client";
import { dir } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { publicEnv } from "@/lib/env";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-arabic",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const ar = locale === "ar";
  return {
    metadataBase: new URL(publicEnv.siteUrl),
    title: {
      default: ar ? "جدارة | من المهارة إلى الفرصة" : "JADARAH | From skill to opportunity",
      template: ar ? "%s · جدارة" : "%s · JADARAH",
    },
    description: ar
      ? "منصة ذكاء المواهب التي تكشف القدرات الحقيقية بالأدلة والتقييم العملي"
      : "The talent intelligence platform that reveals real capability through evidence and practical assessment",
    applicationName: "JADARAH",
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F4E9" },
    { media: "(prefers-color-scheme: dark)", color: "#1C2045" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const theme = (await cookies()).get("jadarah_theme")?.value;
  return (
    <html
      lang={locale}
      dir={dir(locale)}
      data-theme={theme === "dark" || theme === "light" ? theme : undefined}
      className={`${manrope.variable} ${plexArabic.variable}`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="min-h-dvh">
        <a
          href="#main"
          className="focus:bg-primary focus:text-primary-foreground sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[100] focus:rounded-full focus:px-4 focus:py-2"
        >
          {locale === "ar" ? "تخطَّ إلى المحتوى" : "Skip to content"}
        </a>
        <I18nProvider locale={locale}>{children}</I18nProvider>
        <Toaster
          position={locale === "ar" ? "top-left" : "top-right"}
          richColors
          closeButton
          dir={dir(locale)}
        />
      </body>
    </html>
  );
}
