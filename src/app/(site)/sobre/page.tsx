import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { photoViewById } from "@/lib/portfolio";
import { Picture } from "@/components/ui/picture";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/site/reveal";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return { title: "Sobre mim", description: s.aboutText.slice(0, 160), alternates: { canonical: "/sobre" } };
}

export default async function AboutPage() {
  const s = await getSettings();
  const photo = await photoViewById(s.aboutPhotoId);
  return (
    <div className="mx-auto max-w-[1400px] px-5 pb-28 pt-32 md:px-10 md:pt-40">
      <div className="grid gap-12 md:grid-cols-12">
        <Reveal className="md:col-span-5">
          {photo ? <Picture photo={photo} priority sizes="(min-width: 768px) 40vw, 100vw" className="aspect-[4/5]" /> : <div className="aspect-[4/5] bg-ink-2" />}
        </Reveal>
        <Reveal className="md:col-span-6 md:col-start-7" delay={0.1}>
          <p className="eyebrow">Sobre</p>
          <h1 className="display mt-4 text-6xl md:text-8xl">{s.aboutTitle}</h1>
          <div className="mt-10 space-y-6 text-lg leading-relaxed text-paper-2/85">
            {s.aboutText.split(/\n{2,}/).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <div className="mt-12 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/orcamento?origem=sobre" variant="violet" size="lg" arrow>Solicitar orçamento</ButtonLink>
            <ButtonLink href="/portfolio" variant="outline" size="lg">Ver portfólio</ButtonLink>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
