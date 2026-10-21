import "server-only";

/**
 * Leitura centralizada das variáveis de ambiente do servidor.
 * Nada aqui pode ser importado por componentes de cliente ("server-only").
 */
function opt(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

function required(name: string, devFallback?: string): string {
  const v = opt(name);
  if (v) return v;
  if (devFallback !== undefined && process.env.NODE_ENV !== "production") return devFallback;
  throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
}

export const env = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get appUrl() {
    // Render e Railway informam o endereço público automaticamente
    const railway = opt("RAILWAY_PUBLIC_DOMAIN");
    return (opt("APP_URL") ?? opt("RENDER_EXTERNAL_URL") ?? (railway ? `https://${railway}` : undefined) ?? "http://localhost:3000").replace(/\/$/, "");
  },
  /** Segredo para assinar URLs temporárias, cookies de galeria e tokens anti-spam. */
  get appSecret() {
    const s = required("APP_SECRET", "dev-only-insecure-secret-change-me-0123456789");
    if (process.env.NODE_ENV === "production" && s.length < 32) {
      throw new Error("APP_SECRET precisa ter pelo menos 32 caracteres em produção.");
    }
    return s;
  },
  storage: {
    get driver() {
      return (opt("STORAGE_DRIVER") ?? "local") as "local" | "s3";
    },
    get localDir() {
      return opt("STORAGE_LOCAL_DIR") ?? "./storage";
    },
    s3: {
      get endpoint() {
        return opt("S3_ENDPOINT");
      },
      get region() {
        return opt("S3_REGION") ?? "auto";
      },
      get bucket() {
        return required("S3_BUCKET");
      },
      get accessKeyId() {
        return required("S3_ACCESS_KEY_ID");
      },
      get secretAccessKey() {
        return required("S3_SECRET_ACCESS_KEY");
      },
      /** URL pública (CDN) do bucket para variantes públicas. Opcional. */
      get publicUrl() {
        return opt("S3_PUBLIC_URL")?.replace(/\/$/, "");
      },
      get forcePathStyle() {
        return opt("S3_FORCE_PATH_STYLE") === "true";
      },
    },
  },
  ai: {
    get anthropicKey() {
      return opt("ANTHROPIC_API_KEY");
    },
    get model() {
      return opt("AI_MODEL") ?? "claude-opus-5-5";
    },
    get voyageKey() {
      return opt("VOYAGE_API_KEY");
    },
    get embeddingModel() {
      return opt("VOYAGE_EMBEDDING_MODEL") ?? "voyage-multimodal-3";
    },
    get replicateToken() {
      return opt("REPLICATE_API_TOKEN");
    },
    get replicateUpscaleModel() {
      return opt("REPLICATE_UPSCALE_MODEL");
    },
    get replicateBackgroundModel() {
      return opt("REPLICATE_BACKGROUND_MODEL");
    },
  },
  email: {
    get resendKey() {
      return opt("RESEND_API_KEY");
    },
    get smtpUrl() {
      return opt("SMTP_URL");
    },
    get from() {
      return opt("EMAIL_FROM");
    },
    /** Destinatário das notificações de novos orçamentos. */
    get notifyTo() {
      return opt("NOTIFY_EMAIL");
    },
  },
  get turnstileSecret() {
    return opt("TURNSTILE_SECRET_KEY");
  },
  get uploadMaxMb() {
    return Number(opt("UPLOAD_MAX_MB") ?? 40);
  },
};
