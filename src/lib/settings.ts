import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export type WatermarkSettings = {
  enabled: boolean;
  text: string;
  opacity: number; // 0.05–0.6
  position: "center" | "bottom-right" | "bottom-left" | "tiled";
  scale: number; // proporção da largura da imagem (0.1–0.6)
};

export type SiteSettings = {
  brandName: string;
  tagline: string;
  heroEyebrow: string;
  heroTitle: string;
  heroAccent: string; // 2ª linha do título, na cor de destaque
  heroText: string;
  heroPhotoId: string | null;
  heroMobilePhotoId: string | null; // foto vertical opcional para celular
  aboutTitle: string;
  aboutText: string;
  aboutPhotoId: string | null;
  baseCity: string;
  email: string;
  whatsapp: string; // somente dígitos com DDI, ex. 5511999999999
  instagram: string;
  socials: { label: string; url: string }[];
  ctaTitle: string;
  ctaText: string;
  watermark: WatermarkSettings;
  privacyContact: string;
  retentionMonths: number;
  seoDescription: string;
  /** Logos oficiais enviadas no painel (chaves de armazenamento). Vazio = marca recriada. */
  logoOnDarkKey: string | null; // versão branca
  logoOnLightKey: string | null; // versão preta
  logoAccentKey: string | null; // versão roxa
};

export type QuoteOptions = {
  budgetRanges: string[];
  photoCounts: string[];
  deadlines: string[];
  addons: string[];
  durations: string[];
  contactPreferences: string[];
};

export const DEFAULT_SETTINGS: SiteSettings = {
  brandName: "Clickju",
  tagline: "Fotografia de esporte, eventos e marcas",
  heroEyebrow: "Fotografia autoral",
  heroTitle: "Capture o seu",
  heroAccent: "momento decisivo",
  heroText:
    "Esporte, eventos e marcas com olhar cinematográfico — da largada à pista de dança, o instante que vale a pena guardar.",
  heroPhotoId: null,
  heroMobilePhotoId: null,
  aboutTitle: "Sobre mim",
  aboutText:
    "Este é um texto de apresentação de exemplo. Substitua-o no painel administrativo contando sua trajetória, sua forma de trabalhar e o que você valoriza em cada cobertura.\n\nDescreva aqui a sua abordagem: como você se prepara para um evento, como conduz um ensaio e como acontece a entrega das fotografias.",
  aboutPhotoId: null,
  baseCity: "Rio de Janeiro — RJ",
  email: "clickjuu@gmail.com",
  whatsapp: "5521965947941",
  instagram: "",
  socials: [],
  ctaTitle: "Vamos contar a sua história em imagens?",
  ctaText: "Conte o que você precisa. Eu respondo pessoalmente com uma proposta sob medida.",
  watermark: { enabled: true, text: "© Clickju", opacity: 0.28, position: "bottom-right", scale: 0.28 },
  privacyContact: "clickjuu@gmail.com",
  retentionMonths: 24,
  seoDescription:
    "Fotografia esportiva, corridas, eventos, retratos e projetos editoriais. Solicite um orçamento personalizado.",
  logoOnDarkKey: null,
  logoOnLightKey: null,
  logoAccentKey: null,
};

export const DEFAULT_QUOTE_OPTIONS: QuoteOptions = {
  budgetRanges: [
    "Até R$ 1.000",
    "R$ 1.000 a R$ 2.500",
    "R$ 2.500 a R$ 5.000",
    "R$ 5.000 a R$ 10.000",
    "Acima de R$ 10.000",
    "Ainda não defini",
  ],
  photoCounts: ["Até 30", "30 a 80", "80 a 200", "200 a 500", "Mais de 500", "Não sei estimar"],
  deadlines: ["Até 48 horas", "Até 7 dias", "Até 15 dias", "Até 30 dias", "Sem urgência"],
  addons: [
    "Álbum impresso",
    "Impressões fine art",
    "Entrega expressa (mesmo dia)",
    "Vídeo curto para redes sociais",
    "Galeria online para participantes",
    "Segundo fotógrafo",
  ],
  durations: ["Até 1 hora", "1 a 2 horas", "2 a 4 horas", "4 a 8 horas", "Dia inteiro", "Mais de um dia"],
  contactPreferences: ["WhatsApp", "E-mail", "Ligação telefônica"],
};

async function readKey<T>(key: string, fallback: T): Promise<T> {
  const row = await db.query.settings.findFirst({ where: eq(schema.settings.key, key) });
  if (!row) return fallback;
  return { ...fallback, ...(row.value as Partial<T>) };
}

export const getSettings = cache(() => readKey<SiteSettings>("site", DEFAULT_SETTINGS));
export const getQuoteOptions = cache(() => readKey<QuoteOptions>("quote_options", DEFAULT_QUOTE_OPTIONS));

export async function saveSetting(key: "site" | "quote_options", value: unknown) {
  await db
    .insert(schema.settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: new Date() } });
}

export function whatsappLink(number: string, text?: string): string | null {
  const digits = number.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
