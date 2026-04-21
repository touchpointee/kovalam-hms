import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

const hospitalName = process.env.NEXT_PUBLIC_HOSPITAL_NAME ?? "Hospital";

export const metadata: Metadata = {
  applicationName: `${hospitalName} HMS`,
  title: {
    default: `${hospitalName} — HMS`,
    template: `%s | ${hospitalName} HMS`,
  },
  description: `${hospitalName} Hospital Management System`,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/hospital-logo.png", type: "image/png" }],
    apple: [{ url: "/hospital-logo.png", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: `${hospitalName} HMS`,
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#1e3a8a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
