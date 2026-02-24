import type { Metadata } from "next";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import SessionProvider from "@/components/SessionProvider";
import ThemeProvider from "@/components/ThemeProvider";
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
              {children}
            </ThemeProvider>
          </SessionProvider>
          <Toaster position="top-right" richColors />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
