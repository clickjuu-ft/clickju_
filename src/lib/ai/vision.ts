import "server-only";
import { z } from "zod/v4";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { PhotoVariant } from "@/lib/db/schema";
import { storage } from "@/lib/storage";
import { AI_MODEL, AiRefusalError, claude, FALLBACK } from "@/lib/ai/claude";

export const PhotoMetadataSchema = z.object({
  caption: z.string().describe("Legenda curta e editorial em português do Brasil (máx. 140 caracteres), sem inventar nomes, marcas ou locais que não estejam visíveis."),
  alt: z.string().describe("Texto alternativo objetivo para acessibilidade, descrevendo o que se vê (máx. 200 caracteres)."),
  tags: z.array(z.string()).describe("5 a 10 etiquetas em português, minúsculas: modalidade esportiva, ação, ambiente, luz, composição, emoção."),
  category_slug: z.string().describe("Slug da categoria mais adequada dentre as fornecidas, ou string vazia."),
  scene: z.string().describe("Tipo de cena em poucas palavras (ex.: largada de corrida, retrato em estúdio, palco de evento)."),
  sport: z.string().describe("Modalidade esportiva visível, ou string vazia se não houver."),
});
export type PhotoMetadata = z.infer<typeof PhotoMetadataSchema>;

const SYSTEM = `Você auxilia uma fotógrafa profissional a catalogar fotografias.
Descreva apenas o que é visível. Não identifique pessoas, não tente reconhecer quem são, não infira idade exata, etnia, religião ou saúde.
Não invente nomes de eventos, marcas, clientes ou locais. Se um texto/marca estiver claramente legível na imagem, pode citá-lo.
Escreva em português do Brasil, com tom editorial e conciso.`;

/** Gera legenda, texto alternativo, etiquetas e categoria sugerida a partir da variante de 960px. */
export async function describePhoto(photoId: string, categories: { slug: string; name: string }[]): Promise<PhotoMetadata> {
  const photo = await db.query.photos.findFirst({ where: eq(schema.photos.id, photoId) });
  if (!photo) throw new Error("Foto não encontrada");
  const variants = [...(photo.variants as PhotoVariant[])].sort((a, b) => a.w - b.w);
  const v = variants.find((x) => x.w >= 960) ?? variants[variants.length - 1];
  const obj = await storage().get(v.webp);
  if (!obj) throw new Error("Variante não encontrada no armazenamento");

  const res = await claude().beta.messages.parse({
    model: AI_MODEL(),
    max_tokens: 2000,
    ...FALLBACK,
    output_config: { effort: "low", format: betaZodOutputFormat(PhotoMetadataSchema) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/webp", data: obj.body.toString("base64") } },
          {
            type: "text",
            text: `Categorias disponíveis (slug: nome):\n${categories.map((c) => `${c.slug}: ${c.name}`).join("\n")}\n\nGere os metadados desta fotografia.`,
          },
        ],
      },
    ],
  });
  if (res.stop_reason === "refusal") throw new AiRefusalError("A IA recusou analisar esta imagem.");
  if (!res.parsed_output) throw new Error("Resposta da IA em formato inesperado.");
  const out = res.parsed_output;
  return {
    ...out,
    caption: out.caption.slice(0, 200),
    alt: out.alt.slice(0, 300),
    tags: [...new Set(out.tags.map((t) => t.toLowerCase().trim()).filter(Boolean))].slice(0, 12),
    category_slug: categories.some((c) => c.slug === out.category_slug) ? out.category_slug : "",
  };
}

const SequenceSchema = z.object({
  order: z.array(z.string()).describe("IDs das fotografias na ordem narrativa sugerida (todos os IDs recebidos, sem repetir)."),
  rationale: z.string().describe("Explicação curta (3 a 5 frases) da lógica narrativa, em português."),
});

/** Sugere uma sequência narrativa com base em legendas/cenas/horários (sem ver as imagens). */
export async function suggestSequence(items: { id: string; caption: string; scene: string; takenAt: string | null; quality: number | null }[]) {
  const res = await claude().beta.messages.parse({
    model: AI_MODEL(),
    max_tokens: 4000,
    ...FALLBACK,
    output_config: { effort: "medium", format: betaZodOutputFormat(SequenceSchema) },
    system:
      "Você é editora de fotografia. Monte uma sequência narrativa (abertura forte, desenvolvimento com variedade de planos, clímax e encerramento) para uma galeria. Use somente os IDs fornecidos.",
    messages: [{ role: "user", content: `Fotografias (JSON):\n${JSON.stringify(items)}` }],
  });
  if (res.stop_reason === "refusal") throw new AiRefusalError("A IA recusou a solicitação.");
  const out = res.parsed_output;
  if (!out) throw new Error("Resposta da IA em formato inesperado.");
  const valid = new Set(items.map((i) => i.id));
  const order = [...new Set(out.order.filter((id) => valid.has(id)))];
  for (const i of items) if (!order.includes(i.id)) order.push(i.id);
  return { order, rationale: out.rationale };
}
