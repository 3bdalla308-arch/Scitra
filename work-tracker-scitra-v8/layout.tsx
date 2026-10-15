import type { Metadata, Viewport } from "next";
import "@fontsource/cairo/arabic-400.css";
import "@fontsource/cairo/arabic-600.css";
import "@fontsource/cairo/arabic-700.css";
import "@fontsource/cairo/latin-400.css";
import "@fontsource/cairo/latin-600.css";
import "@fontsource/cairo/latin-700.css";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { SwRegister } from "@/components/sw-register";

const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

const SITE_URL = "https://scitra.vercel.app";
const DESCRIPTION =
  "Scitra: سجّل أيام شغلك واحسب مرتبك وسلفك وخصوماتك بسهولة حسب نظام مكتبك، وبيشتغل بدون إنترنت.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Scitra",
  description: DESCRIPTION,
  applicationName: "Scitra",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  verification: { google: "FqR0R-faCq3u3DmWMJem_S3dKwj1BY7ZeqxasReWs_k" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Scitra",
    title: "Scitra",
    description: DESCRIPTION,
    locale: "ar_EG",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Scitra" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Scitra",
    description: DESCRIPTION,
    images: ["/og.png"],
  },
  manifest: `${base}/manifest.webmanifest`,
  icons: { icon: `${base}/icon-192.png`, apple: `${base}/icon-192.png` },
  appleWebApp: { capable: true, title: "Scitra", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#1f63b8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body
        className="font-sans antialiased bg-background text-foreground"
      >
        {children}
        <Toaster />
        <SwRegister />
      </body>
    </html>
  );
}
