import Link from "next/link";
import { AtSign, Mail, MessageCircle } from "lucide-react";
import type { SiteSettings } from "@/lib/settings";
import { whatsappLink } from "@/lib/settings";
import { Logo } from "@/components/ui/logo";

export function Footer({
  settings,
  categories,
  logoSrc,
}: {
  settings: SiteSettings;
  categories: { slug: string; name: string }[];
  logoSrc?: string | null;
}) {
  const wa = whatsappLink(settings.whatsapp, "Olá! Vim pelo site e gostaria de conversar.");
  const year = new Date().getFullYear();
  return (
    <footer className="theme-dark border-t border-line bg-ink">
      <div className="mx-auto max-w-[1600px] px-5 py-16 md:px-10 md:py-24">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-5">
            {logoSrc ? (
              <div className="h-28 md:h-36">
                <Logo src={logoSrc} label={settings.brandName} />
              </div>
            ) : (
              <Logo className="text-[3.6rem] text-[#9900FF] md:text-[5.5rem]" label={settings.brandName} />
            )}
            <p className="mt-4 max-w-sm text-mist">{settings.tagline}</p>
            <p className="mt-1 text-sm text-mist/80">{settings.baseCity}</p>
          </div>
          <nav aria-label="Portfólio" className="md:col-span-2">
            <p className="eyebrow mb-4">Portfólio</p>
            <ul className="space-y-2 text-sm">
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link className="text-paper-2/75 transition-colors hover:text-paper" href={`/portfolio?categoria=${c.slug}`}>
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Institucional" className="md:col-span-2">
            <p className="eyebrow mb-4">Site</p>
            <ul className="space-y-2 text-sm">
              {[
                ["/servicos", "Serviços"],
                ["/sobre", "Sobre mim"],
                ["/orcamento", "Solicitar orçamento"],
                ["/blog", "Blog"],
                ["/contato", "Contato"],
                ["/login", "Área do cliente"],
              ].map(([href, label]) => (
                <li key={href}>
                  <Link className="text-paper-2/75 transition-colors hover:text-paper" href={href}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="md:col-span-3">
            <p className="eyebrow mb-4">Contato</p>
            <ul className="space-y-3 text-sm">
              {settings.email && (
                <li>
                  <a className="inline-flex items-center gap-2 text-paper-2/75 hover:text-paper" href={`mailto:${settings.email}`}>
                    <Mail className="size-4" aria-hidden /> {settings.email}
                  </a>
                </li>
              )}
              {wa && (
                <li>
                  <a className="inline-flex items-center gap-2 text-paper-2/75 hover:text-paper" href={wa} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="size-4" aria-hidden /> WhatsApp
                  </a>
                </li>
              )}
              {settings.instagram && (
                <li>
                  <a
                    className="inline-flex items-center gap-2 text-paper-2/75 hover:text-paper"
                    href={`https://instagram.com/${settings.instagram.replace(/^@/, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <AtSign className="size-4" aria-hidden /> @{settings.instagram.replace(/^@/, "")}
                  </a>
                </li>
              )}
              {settings.socials.map((s) => (
                <li key={s.url}>
                  <a className="text-paper-2/75 hover:text-paper" href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-16 flex flex-col gap-4 border-t border-line pt-6 text-xs text-mist md:flex-row md:items-center md:justify-between">
          <p>
            © {year} {settings.brandName}. Todas as imagens são protegidas por direitos autorais.
          </p>
          <div className="flex gap-6">
            <Link href="/privacidade" className="hover:text-paper">
              Política de privacidade
            </Link>
            <Link href="/termos" className="hover:text-paper">
              Termos de uso
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
