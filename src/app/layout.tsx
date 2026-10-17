import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "UstaPlan", template: "%s · UstaPlan" },
  description: "Ustalar için iş, randevu ve müşteri takibi.",
  applicationName: "UstaPlan",
  appleWebApp: { capable: true, title: "UstaPlan", statusBarStyle: "default" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#19745A",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className="h-full">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
