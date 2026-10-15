import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./oxblood.css";
import { fontVariables } from "./fonts.ts";

export const metadata: Metadata = {
  title: "Automation Health Check · Rollcfluence",
  description: "See what your automations get wrong, silently. Runs entirely in your browser.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
