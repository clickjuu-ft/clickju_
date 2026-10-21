import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { PhotoVariant } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { storage } from "@/lib/storage";

/**
 * Busca semântica por imagem via Voyage AI (embeddings multimodais: texto e imagem no mesmo espaço).
 * Opcional: sem VOYAGE_API_KEY, a busca usa o texto (legendas/etiquetas) com o índice do Postgres.
 */
export function embeddingsEnabled() {
  return !!env.ai.voyageKey;
}

type Content = { type: "text"; text: string } | { type: "image_base64"; image_base64: string };

async function voyage(inputs: { content: Content[] }[], inputType: "query" | "document"): Promise<number[][]> {
  const res = await fetch("https://api.voyageai.com/v1/multimodalembeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.ai.voyageKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ inputs, model: env.ai.embeddingModel, input_type: inputType }),
  });
  if (!res.ok) throw new Error(`Voyage AI: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { data: { embedding: number[] }[] };
  return data.data.map((d) => d.embedding);
}

export async function embedPhoto(photoId: string) {
  const photo = await db.query.photos.findFirst({ where: eq(schema.photos.id, photoId) });
  if (!photo) return;
  const v = [...(photo.variants as PhotoVariant[])].sort((a, b) => a.w - b.w)[0];
  const obj = await storage().get(v.webp);
  if (!obj) return;
  const content: Content[] = [{ type: "image_base64", image_base64: `data:image/webp;base64,${obj.body.toString("base64")}` }];
  if (photo.searchText) content.unshift({ type: "text", text: photo.searchText });
  const [embedding] = await voyage([{ content }], "document");
  await db.update(schema.photos).set({ embedding, embeddingModel: env.ai.embeddingModel }).where(eq(schema.photos.id, photoId));
}

export async function embedQuery(text: string) {
  const [e] = await voyage([{ content: [{ type: "text", text }] }], "query");
  return e;
}
