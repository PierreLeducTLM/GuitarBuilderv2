import { themes } from "@gb/ui/tokens";
import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTimeZone, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AppProviders } from "@/components/AppProviders";
import { TimeZoneCookie } from "@/components/TimeZoneCookie";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return { title: t("documentTitle"), description: t("description") };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: themes.dark.ground },
    { media: "(prefers-color-scheme: light)", color: themes.light.ground },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [locale, timeZone] = await Promise.all([getLocale(), getTimeZone()]);
  return (
    // The inline script sets data-theme and color-scheme before React hydrates.
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: static first-paint theme script, no user input
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
      </head>
      <body>
        <NextIntlClientProvider>
          <AppProviders>{children}</AppProviders>
          <TimeZoneCookie current={timeZone} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
