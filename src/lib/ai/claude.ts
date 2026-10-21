import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

/** A IA só é usada se ANTHROPIC_API_KEY estiver definida. Nada é simulado sem ela. */
export function aiEnabled() {
  return !!env.ai.anthropicKey;
}

const g = globalThis as unknown as { __anthropic?: Anthropic };
export function claude(): Anthropic {
  if (!env.ai.anthropicKey) throw new Error("IA não configurada (ANTHROPIC_API_KEY ausente).");
  g.__anthropic ??= new Anthropic({ apiKey: env.ai.anthropicKey, maxRetries: 2, timeout: 90_000 });
  return g.__anthropic;
}

export const AI_MODEL = () => env.ai.model;

/**
 * Parâmetros comuns: fallback automático do servidor caso a requisição seja recusada
 * pelos classificadores de segurança (modo "default", roteado por categoria).
 */
export const FALLBACK = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default" as const,
};

export class AiRefusalError extends Error {}
