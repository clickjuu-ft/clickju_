import "server-only";
import { env } from "@/lib/env";
import { emailConfigured } from "@/lib/email";

/** Situação real de cada integração externa — exibida no painel, sem simulação. */
export function integrationStatus() {
  return [
    { key: "email", label: "E-mail transacional", ok: emailConfigured(), how: "Defina RESEND_API_KEY (ou SMTP_URL) e EMAIL_FROM." },
    { key: "ai", label: "IA (Claude) — assistente e legendas", ok: !!env.ai.anthropicKey, how: "Defina ANTHROPIC_API_KEY." },
    { key: "embeddings", label: "Busca semântica por imagem (Voyage)", ok: !!env.ai.voyageKey, how: "Defina VOYAGE_API_KEY." },
    {
      key: "replicate",
      label: "Aprimoramento/remoção de fundo (Replicate)",
      ok: !!env.ai.replicateToken && !!(env.ai.replicateUpscaleModel || env.ai.replicateBackgroundModel),
      how: "Defina REPLICATE_API_TOKEN e os modelos REPLICATE_UPSCALE_MODEL / REPLICATE_BACKGROUND_MODEL.",
    },
    { key: "storage", label: `Armazenamento (${env.storage.driver === "s3" ? "S3/Supabase/R2" : "disco local"})`, ok: true, how: "STORAGE_DRIVER=s3 para produção em nuvem." },
    { key: "turnstile", label: "Cloudflare Turnstile (anti-robô extra)", ok: !!env.turnstileSecret, how: "Opcional: TURNSTILE_SECRET_KEY e NEXT_PUBLIC_TURNSTILE_SITE_KEY." },
  ];
}
