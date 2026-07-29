import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import SessionProvider from "@/components/SessionProvider";
import ThemeProvider from "@/components/ThemeProvider";
import { SearchIndexProvider } from "@/components/SearchIndexProvider";
import LocaleSync from "@/components/LocaleSync";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import { Toaster } from "sonner";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserLocale } from "@/lib/locale";
import "./globals.css";

// Use system fonts instead of Google Fonts to avoid network calls during Docker build
// This is more performant and doesn't require external requests during build time

export const metadata: Metadata = {
  title: "Nametag - Personal Relationships Manager",
  description: "Manage your relationships, track important details, and visualize your network",
  // iOS ignores the manifest for these, so they have to be meta tags.
  appleWebApp: {
    capable: true,
    title: "Nametag",
    // 'black-translucent' would extend the web view under the status bar and
    // require safe-area padding work on Navigation. Not worth it here.
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
  /*
   * Next emits the standard `mobile-web-app-capable` for `appleWebApp.capable`,
   * but iOS Safari only reads Apple's prefixed spelling, so it has to be added
   * by hand. The manifest's `display: standalone` already delivers standalone
   * mode on iOS 11.3 and later, making this belt and braces rather than
   * load-bearing, but it is also the tag that makes apple-touch-startup-image
   * work if splash screens are ever added.
   */
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Pre-hydration default matching the default DARK theme. ThemeProvider
  // corrects this on the client for users whose saved theme is LIGHT.
  themeColor: "#121110",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  // Get user's theme preference from database
  let initialTheme: 'LIGHT' | 'DARK' = 'DARK';
  if (session?.user?.id) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { theme: true },
      });
      if (user?.theme) {
        initialTheme = user.theme;
      }
    } catch {
      // Fall back to default theme if DB is unavailable
    }
  }

  // Get locale and messages for i18n
  const locale = await getUserLocale(session?.user?.id);
  const messages = await getMessages();

  return (
    <html lang={locale} className={initialTheme === 'DARK' ? 'dark' : ''}>
      <body className="antialiased">
        <NextIntlClientProvider messages={messages} locale={locale}>
          <SessionProvider>
            <ThemeProvider initialTheme={initialTheme}>
              <SearchIndexProvider>
                {children}
              </SearchIndexProvider>
            </ThemeProvider>
          </SessionProvider>
          <LocaleSync locale={locale} />
          <ServiceWorkerRegistration />
          <Toaster position="top-right" richColors />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
