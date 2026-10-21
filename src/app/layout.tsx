import type { Metadata, Viewport } from "next";
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "./globals.css";
import { getSettings } from "@/lib/settings";
import { env } from "@/lib/env";

// Conteúdo vem do banco e é editável pelo painel: renderização por requisição.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    metadataBase: new URL(env.appUrl),
    title: { default: `${s.brandName} — ${s.tagline}`, template: `%s — ${s.brandName}` },
    description: s.seoDescription,
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName: s.brandName,
      title: `${s.brandName} — ${s.tagline}`,
      description: s.seoDescription,
    },
    twitter: { card: "summary_large_image" },
  };
}

export const viewport: Viewport = {
  themeColor: "#09090D",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-paper focus:px-4 focus:py-2 focus:text-ink"
        >
          Pular para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
