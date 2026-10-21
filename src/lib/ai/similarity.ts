import "server-only";
import { cosine, hamming } from "@/lib/images/process";

type P = { id: string; dhash: string | null; colorVector: number[] | null; embedding: number[] | null; qualityScore: number | null; takenAt: Date | null };

/**
 * Agrupa fotografias semelhantes (union-find).
 *  - quase idênticas (rajadas): dHash com distância ≤ 8
 *  - semelhantes: embeddings com cosseno ≥ 0.9 (se houver) ou dHash ≤ 16 + histograma de cor ≥ 0.97
 * Tudo calculado localmente; nenhum dado sai do servidor.
 */
export function groupSimilar(photos: P[], strictness: "duplicatas" | "semelhantes" = "semelhantes") {
  const parent = photos.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (a: number, b: number) => (parent[find(a)] = find(b));
  for (let i = 0; i < photos.length; i++) {
    for (let j = i + 1; j < photos.length; j++) {
      const a = photos[i];
      const b = photos[j];
      if (!a.dhash || !b.dhash) continue;
      const h = hamming(a.dhash, b.dhash);
      let same = h <= 8;
      if (!same && strictness === "semelhantes") {
        if (a.embedding && b.embedding) same = cosine(a.embedding, b.embedding) >= 0.9;
        else if (a.colorVector && b.colorVector) same = h <= 16 && cosine(a.colorVector, b.colorVector) >= 0.97;
      }
      if (same) union(i, j);
    }
  }
  const groups = new Map<number, P[]>();
  photos.forEach((p, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), p]));
  return [...groups.values()]
    .map((g) => g.sort((x, y) => (y.qualityScore ?? 0) - (x.qualityScore ?? 0)))
    .sort((a, b) => b.length - a.length);
}

/** Sugestão de seleção: a melhor (nota técnica) de cada grupo, acima de um mínimo. */
export function suggestSelection(groups: P[][], minScore = 35) {
  return groups.map((g) => g[0]).filter((p) => (p.qualityScore ?? 0) >= minScore);
}

/** Sequência heurística (sem IA): cronológica, evitando duas fotos seguidas do mesmo grupo. */
export function heuristicSequence(photos: P[], groups: P[][]) {
  const groupOf = new Map<string, number>();
  groups.forEach((g, i) => g.forEach((p) => groupOf.set(p.id, i)));
  const sorted = [...photos].sort((a, b) => (a.takenAt?.getTime() ?? 0) - (b.takenAt?.getTime() ?? 0));
  const out: P[] = [];
  const rest = [...sorted];
  while (rest.length) {
    const lastGroup = out.length ? groupOf.get(out[out.length - 1].id) : undefined;
    const idx = rest.findIndex((p) => groupOf.get(p.id) !== lastGroup);
    out.push(...rest.splice(idx >= 0 ? idx : 0, 1));
  }
  return out.map((p) => p.id);
}
