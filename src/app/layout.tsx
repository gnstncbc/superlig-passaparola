import type { Metadata, Viewport } from "next";
import "./globals.css";
import { settingsBootScript } from "@/lib/settings";

function siteUrl(): URL {
  const host =
    process.env.VERCEL_ENV === "production"
      ? process.env.VERCEL_PROJECT_PRODUCTION_URL
      : (process.env.VERCEL_BRANCH_URL ?? process.env.VERCEL_URL);
  return new URL(host ? `https://${host}` : "http://localhost:3000");
}

const description = "Her gün yeni 26 soru. A'dan Z'ye modern Süper Lig bilgini 4 dakikada test et.";

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: "Passaparola · Süper Lig",
  description,
  icons: { icon: "/icon.svg" },
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: "Passaparola Süper Lig",
    title: "Passaparola · Süper Lig",
    description,
    url: "/",
  },
  // Stop mobile browsers from turning scores like "25 Doğru" into address links.
  formatDetection: { telephone: false, address: false, email: false, date: false },
  twitter: {
    card: "summary_large_image",
    title: "Passaparola · Süper Lig",
    description,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#121213" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: settingsBootScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
