import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { env } from "@/lib/env";
import { signPayload } from "@/lib/crypto";

/**
 * Armazenamento de objetos. Todos os objetos são privados; o acesso se dá por
 * URLs temporárias assinadas. Para conteúdo público, a validade é "arredondada"
 * (mesma URL durante ~1 dia) para permitir cache em navegador/CDN.
 *
 *  - originals/<photoId>.<ext>        arquivo original — nunca sobrescrito
 *  - v/<photoId>/<rev>/<w>.<fmt>       variantes otimizadas (AVIF/WebP)
 *  - derived/<photoId>/<jobId>.<ext>   saídas das ferramentas de imagem
 *  - attachments/<quoteId>/<n>.<ext>   anexos de orçamentos
 */
export interface StorageDriver {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<{ body: Buffer; contentType: string } | null>;
  delete(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
  signedUrl(key: string, opts: UrlOptions): Promise<string>;
}

export type UrlOptions = {
  /** public = conteúdo do portfólio público (URL estável ~1 dia); private = curta duração */
  access: "public" | "private";
  /** nome de arquivo para forçar download */
  download?: string;
};

const KEY_RE = /^[a-zA-Z0-9][a-zA-Z0-9/_.-]*$/;
export function assertKey(key: string) {
  if (!KEY_RE.test(key) || key.includes("..") || key.includes("//")) throw new Error("Chave de armazenamento inválida");
}

export function expiryFor(access: "public" | "private"): number {
  const now = Math.floor(Date.now() / 1000);
  if (access === "public") {
    const day = 86400;
    return Math.floor(now / day) * day + 2 * day; // válido por 1–2 dias, estável durante o dia
  }
  const bucket = 600;
  return Math.floor(now / bucket) * bucket + 3600; // ~1h
}

export function contentTypeFor(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase();
  return (
    {
      avif: "image/avif",
      webp: "image/webp",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      tif: "image/tiff",
      tiff: "image/tiff",
      heic: "image/heic",
      pdf: "application/pdf",
      svg: "image/svg+xml",
    } as Record<string, string>
  )[ext ?? ""] ?? "application/octet-stream";
}

/* ---------------------------- disco local ---------------------------- */

class LocalDriver implements StorageDriver {
  private root = path.resolve(env.storage.localDir);
  private file(key: string) {
    assertKey(key);
    const p = path.resolve(this.root, key);
    if (!p.startsWith(this.root + path.sep)) throw new Error("Caminho fora do armazenamento");
    return p;
  }
  async put(key: string, body: Buffer) {
    const p = this.file(key);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, body);
  }
  async get(key: string) {
    try {
      return { body: await fs.readFile(this.file(key)), contentType: contentTypeFor(key) };
    } catch {
      return null;
    }
  }
  async delete(key: string) {
    await fs.rm(this.file(key), { force: true });
  }
  async deletePrefix(prefix: string) {
    await fs.rm(this.file(prefix.replace(/\/$/, "")), { recursive: true, force: true });
  }
  async signedUrl(key: string, opts: UrlOptions) {
    assertKey(key);
    const e = expiryFor(opts.access);
    const dl = opts.download ?? "";
    const a = opts.access === "public" ? "p" : "r";
    const s = signPayload(`${key}|${dl}|${a}`, e);
    const qs = new URLSearchParams({ e: String(e), a, s });
    if (dl) qs.set("dl", dl);
    return `/api/media/${key}?${qs}`;
  }
}

/* --------------------- S3 / Supabase Storage / R2 -------------------- */

class S3Driver implements StorageDriver {
  private clientPromise = (async () => {
    const { S3Client } = await import("@aws-sdk/client-s3");
    return new S3Client({
      region: env.storage.s3.region,
      endpoint: env.storage.s3.endpoint,
      forcePathStyle: env.storage.s3.forcePathStyle,
      credentials: {
        accessKeyId: env.storage.s3.accessKeyId,
        secretAccessKey: env.storage.s3.secretAccessKey,
      },
    });
  })();
  private bucket = env.storage.s3.bucket;

  async put(key: string, body: Buffer, contentType: string) {
    assertKey(key);
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    await (await this.clientPromise).send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }
  async get(key: string) {
    assertKey(key);
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    try {
      const res = await (await this.clientPromise).send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      const bytes = await res.Body!.transformToByteArray();
      return { body: Buffer.from(bytes), contentType: res.ContentType ?? contentTypeFor(key) };
    } catch {
      return null;
    }
  }
  async delete(key: string) {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    await (await this.clientPromise).send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
  async deletePrefix(prefix: string) {
    const { ListObjectsV2Command, DeleteObjectsCommand } = await import("@aws-sdk/client-s3");
    const client = await this.clientPromise;
    let token: string | undefined;
    do {
      const list = await client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }),
      );
      const objs = (list.Contents ?? []).map((o) => ({ Key: o.Key! }));
      if (objs.length) await client.send(new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: objs } }));
      token = list.IsTruncated ? list.NextContinuationToken : undefined;
    } while (token);
  }
  async signedUrl(key: string, opts: UrlOptions) {
    assertKey(key);
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const exp = expiryFor(opts.access);
    // data de assinatura "arredondada" → mesma URL por um período (cache de CDN)
    const signingDate = new Date((exp - (opts.access === "public" ? 2 * 86400 : 3600)) * 1000);
    const url = await getSignedUrl(
      await this.clientPromise,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: opts.download
          ? `attachment; filename="${opts.download.replace(/"/g, "")}"`
          : undefined,
      }),
      { expiresIn: opts.access === "public" ? 2 * 86400 : 3600, signingDate },
    );
    // Se houver CDN na frente do bucket, troca o host mantendo a assinatura.
    const cdn = env.storage.s3.publicUrl;
    if (cdn) {
      const u = new URL(url);
      return `${cdn}${u.pathname.replace(`/${this.bucket}`, "")}${u.search}`;
    }
    return url;
  }
}

const g = globalThis as unknown as { __storage?: StorageDriver };
export function storage(): StorageDriver {
  if (!g.__storage) g.__storage = env.storage.driver === "s3" ? new S3Driver() : new LocalDriver();
  return g.__storage;
}
