import type { NextConfig } from "next";

const noIndex = [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }];

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // o pdfkit lê as métricas das fontes-padrão do disco
  outputFileTracingIncludes: {
    "/api/admin/proposals/**": ["./node_modules/pdfkit/js/data/**"],
    "/api/proposals/**": ["./node_modules/pdfkit/js/data/**"],
  },
  // sharp, pdfkit e o driver postgres usam módulos nativos/arquivos de fonte: não empacotar.
  serverExternalPackages: ["sharp", "pdfkit", "postgres", "nodemailer"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/admin/:path*", headers: noIndex },
      { source: "/admin", headers: noIndex },
      { source: "/cliente/:path*", headers: noIndex },
      { source: "/cliente", headers: noIndex },
      { source: "/api/:path*", headers: noIndex },
      { source: "/proposta/:path*", headers: noIndex },
      { source: "/g/:path*", headers: noIndex },
    ];
  },
};

export default nextConfig;
