// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Mourne-oids Hub",
    template: "%s | Mourne-oids Hub",
  },
  description:
    "The central hub for Daily OER Walkthroughs, Deep Clean checklists, and weekly MemoMailer.",
  openGraph: {
    title: "Mourne-oids Hub",
    description:
      "The central hub for Daily OER Walkthroughs, Deep Clean checklists, and weekly MemoMailer.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mourne-oids Hub",
    description:
      "The central hub for Daily OER Walkthroughs, Deep Clean checklists, and weekly MemoMailer.",
  },
  // Optional nice-to-haves:
  metadataBase:
    typeof process !== "undefined" && process?.env?.NEXT_PUBLIC_SITE_URL
      ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
      : undefined,
  applicationName: "Mourne-oids Hub",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
