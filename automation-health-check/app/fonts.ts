import localFont from "next/font/local";

/*
 * Fonts ship inside the app (app/fonts), so HQ never downloads anything at run time.
 * Fraunces and Geist are licensed under the SIL Open Font License 1.1 (see app/fonts/*.txt).
 */
export const fraunces = localFont({
  src: [
    { path: "./fonts/Fraunces-Variable.woff2", style: "normal", weight: "100 900" },
    { path: "./fonts/Fraunces-Italic-Variable.woff2", style: "italic", weight: "100 900" },
  ],
  variable: "--font-fraunces",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

export const geist = localFont({
  src: "./fonts/Geist-Variable.woff2",
  weight: "100 900",
  variable: "--font-geist",
  display: "swap",
});

export const geistMono = localFont({
  src: "./fonts/GeistMono-Variable.woff2",
  weight: "100 900",
  variable: "--font-geist-mono",
  display: "swap",
  adjustFontFallback: false,
});

export const fontVariables = `${fraunces.variable} ${geist.variable} ${geistMono.variable}`;
