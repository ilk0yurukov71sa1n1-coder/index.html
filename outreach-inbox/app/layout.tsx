import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./oxblood.css";
import { fontVariables } from "./fonts.ts";

export const metadata: Metadata = {
  title: "Outreach Inbox · Rollcfluence",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
