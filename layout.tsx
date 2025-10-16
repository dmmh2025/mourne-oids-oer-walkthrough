export const dynamic = "force-static";

import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mourne-oids • Daily OER Walkthrough",
  description: "Simple, fast OER checks with clean analytics.",
  themeColor: "#006491",
  viewport: "width=device-width, initial-scale=1, viewport-fit=cover",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Inter font */}
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
