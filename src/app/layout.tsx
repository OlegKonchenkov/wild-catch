import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Cinzel, DM_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["500", "600", "700", "900"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: 'Daimon',
  description: 'Cattura creature nell\'avventura outdoor!',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Daimon',
  },
  formatDetection: { telephone: false },
};

// Next 16-sanctioned viewport export (replaces the manual <meta viewport> /
// <meta theme-color> tags). `viewportFit: 'cover'` is what activates the
// `env(safe-area-inset-*)` values the shell relies on to clear the notch.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0F1F2E",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      // Browser extensions (e.g. Bitdefender's TrafficLight/Wallet) inject
      // attributes like `bis_skin_checked`, `bis_register` and
      // `__processed_<uuid>__` onto <html>/<body> BEFORE React hydrates,
      // which otherwise trips a hydration-mismatch warning that isn't our
      // bug. Suppressing on these two elements is the Next.js-sanctioned fix.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${cinzel.variable} ${dmSans.variable} h-full antialiased`}
    >
      <head>
        {/* viewport + theme-color come from the `viewport` export above;
            apple-mobile-web-app-* come from metadata.appleWebApp. Only the
            bits the Metadata API doesn't emit are declared by hand here. */}
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        {/* Next auto-emits the modern `mobile-web-app-capable` from
            metadata.appleWebApp, but NOT the legacy `apple-mobile-web-app-capable`
            that older iOS (< 16.4) still needs for standalone launch. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        {children}
        <Script
          id="sw-registration"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(function(err) {
                  console.error('SW registration failed:', err);
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
