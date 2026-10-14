import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/** The page may only talk to this local app. Mail is sent by the server, never by the browser. */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    // The error log writes to a path chosen at run time (data/logs). That makes Turbopack warn about
    // file tracing, which only matters for deployed "standalone" builds. HQ runs from its own folder.
    ignoreIssue: [{ path: "**/core/errorLog.ts", title: /Dynamic filesystem access/ }],
  },
  serverExternalPackages: ["imapflow", "nodemailer", "mailparser"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
