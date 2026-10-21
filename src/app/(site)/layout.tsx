import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { ChatWidget } from "@/components/site/chat-widget";
import { getSettings } from "@/lib/settings";
import { getCategories } from "@/lib/portfolio";
import { getCurrentUser } from "@/lib/auth/session";
import { logoUrls } from "@/lib/branding";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, categories, user] = await Promise.all([getSettings(), getCategories(), getCurrentUser()]);
  const logos = await logoUrls(settings);
  const account = user
    ? user.role === "admin"
      ? { href: "/admin", label: "Painel" }
      : { href: "/cliente", label: "Minha área" }
    : null;
  return (
    <>
      <Header brandName={settings.brandName} logos={{ onDark: logos.onDark, onLight: logos.onLight ?? null }} account={account} />
      <main id="conteudo">{children}</main>
      <Footer settings={settings} categories={categories} logoSrc={logos.accent} />
      <ChatWidget />
    </>
  );
}
