import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { MessageCircle, Clock, ShieldCheck, FileText } from "lucide-react";
import { db, schema } from "@/lib/db";
import { getQuoteOptions, getSettings, whatsappLink } from "@/lib/settings";
import { issueFormToken } from "@/lib/quotes/service";
import { QuoteForm } from "@/components/quote/quote-form";

export const metadata: Metadata = {
  title: "Solicitar orçamento",
  description: "Conte sobre seu evento, ensaio ou cobertura esportiva e receba uma proposta personalizada.",
  alternates: { canonical: "/orcamento" },
};

export default async function QuotePage(props: PageProps<"/orcamento">) {
  const sp = await props.searchParams;
  const [settings, options, services] = await Promise.all([
    getSettings(),
    getQuoteOptions(),
    db.query.services.findMany({ where: eq(schema.services.active, true), orderBy: [asc(schema.services.sort)] }),
  ]);
  const wa = whatsappLink(settings.whatsapp);
  const str = (v: unknown) => (typeof v === "string" ? v.slice(0, 80) : undefined);

  return (
    <div className="mx-auto max-w-[1600px] px-5 pb-28 pt-32 md:px-10 md:pt-40">
      <div className="grid gap-16 lg:grid-cols-12">
        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-32">
            <p className="eyebrow">Orçamento</p>
            <h1 className="display mt-4 text-[clamp(3.2rem,7vw,6.5rem)]">
              Solicitar <span className="serif-accent text-lilac">orçamento</span>
            </h1>
            <p className="mt-6 max-w-sm text-lg text-paper-2/75">
              Leva cerca de 3 minutos. Não é preciso criar conta. Quanto mais detalhes, mais precisa será a proposta.
            </p>
            <ul className="mt-10 space-y-5 text-sm text-paper-2/80">
              <li className="flex gap-3">
                <Clock className="mt-0.5 size-4 shrink-0 text-lilac" aria-hidden />
                Resposta pessoal, pelo canal que você preferir.
              </li>
              <li className="flex gap-3">
                <FileText className="mt-0.5 size-4 shrink-0 text-lilac" aria-hidden />
                Valores e disponibilidade são definidos na proposta — nada é confirmado automaticamente.
              </li>
              <li className="flex gap-3">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-lilac" aria-hidden />
                Seus dados são usados apenas para esta solicitação (LGPD).
              </li>
            </ul>
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-10 inline-flex items-center gap-2 rounded-full border border-line-strong px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] transition-colors hover:border-paper hover:bg-paper hover:text-ink"
              >
                <MessageCircle className="size-4" aria-hidden /> Prefere conversar? WhatsApp
              </a>
            )}
          </div>
        </aside>
        <div className="lg:col-span-7 lg:col-start-6">
          <QuoteForm
            services={services.map((s) => ({ slug: s.slug, name: s.name, description: s.description }))}
            options={options}
            formToken={issueFormToken()}
            initialService={str(sp.servico)}
            source={str(sp.origem)}
            whatsapp={wa}
            turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined}
          />
        </div>
      </div>
    </div>
  );
}
