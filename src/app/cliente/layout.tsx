import type { Metadata } from "next";
import { Header } from "@/components/site/header";
import { getSettings } from "@/lib/settings";
import { logoUrls } from "@/lib/branding";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: { default: "Área do cliente", template: "%s — Área do cliente" },
  robots: { index: false, follow: false, nocache: true },
};

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/cliente");
  const settings = await getSettings();
  const logos = await logoUrls(settings);
  return (
    <>
      <Header
        brandName={settings.brandName}
        logos={{ onDark: logos.onDark, onLight: logos.onLight }}
        account={user.role === "admin" ? { href: "/admin", label: "Painel" } : { href: "/cliente", label: "Minha área" }}
      />
      <main id="conteudo" className="mx-auto max-w-[1600px] px-5 pb-24 pt-28 md:px-10 md:pt-36">
        {children}
      </main>
    </>
  );
}
