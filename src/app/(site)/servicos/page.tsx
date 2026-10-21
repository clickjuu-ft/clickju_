import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/site/reveal";
import { formatBRL } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Serviços",
  description: "Fotografia esportiva, corridas, eventos, marcas e ativações, retratos, corporativo e editorial.",
  alternates: { canonical: "/servicos" },
};

export default async function ServicesPage() {
  const services = await db.query.services.findMany({ where: eq(schema.services.active, true), orderBy: [asc(schema.services.sort)] });
  return (
    <div className="mx-auto max-w-[1400px] px-5 pb-28 pt-32 md:px-10 md:pt-40">
      <Reveal>
        <p className="eyebrow">Serviços</p>
        <h1 className="display mt-4 text-[clamp(3.5rem,9vw,8.5rem)]">
          Coberturas <span className="serif-accent text-lilac">sob medida</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-paper-2/80">
          Cada projeto recebe uma proposta personalizada, de acordo com a duração, a equipe necessária, os entregáveis e o prazo.
        </p>
      </Reveal>
      <ol className="mt-20 border-t border-line">
        {services.map((s, i) => (
          <Reveal as="li" key={s.id} className="grid gap-6 border-b border-line py-10 md:grid-cols-12 md:py-14">
            <span className="text-xs tabular-nums text-mist md:col-span-1">{String(i + 1).padStart(2, "0")}</span>
            <div className="md:col-span-5">
              <h2 className="display text-4xl md:text-5xl">{s.name}</h2>
              {s.showPrice && s.priceFrom && (
                <p className="mt-4 text-sm">
                  A partir de <strong className="text-lg">{formatBRL(s.priceFrom)}</strong>
                  {s.priceNote && <span className="block text-mist">{s.priceNote}</span>}
                </p>
              )}
            </div>
            <div className="md:col-span-6">
              {s.description && <p className="text-lg text-paper-2/85">{s.description}</p>}
              {s.coverage && <p className="mt-4 whitespace-pre-line text-sm text-mist">{s.coverage}</p>}
              <ButtonLink href={`/orcamento?servico=${s.slug}&origem=servicos`} variant="ghost" arrow className="mt-6 px-0">
                Solicitar orçamento
              </ButtonLink>
            </div>
          </Reveal>
        ))}
      </ol>
    </div>
  );
}
