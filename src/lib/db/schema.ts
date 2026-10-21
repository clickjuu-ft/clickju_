import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const userRole = pgEnum("user_role", ["admin", "client"]);

export const quoteStatus = pgEnum("quote_status", [
  "novo",
  "em_analise",
  "aguardando_info",
  "preparando_proposta",
  "proposta_enviada",
  "em_negociacao",
  "aprovado",
  "recusado",
  "cancelado",
]);

export const projectVisibility = pgEnum("project_visibility", [
  "public", // aparece no portfólio
  "unlisted", // acessível só pelo link
  "password", // exige senha
  "private", // só clientes autorizados
]);

export const clientProjectStage = pgEnum("client_project_stage", [
  "agendado",
  "em_producao",
  "em_edicao",
  "selecao_cliente",
  "finalizando",
  "entregue",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

/* ------------------------------------------------------------------ */
/* Usuários e autenticação                                             */
/* ------------------------------------------------------------------ */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").notNull().default("client"),
    disabled: boolean("disabled").notNull().default(false),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("users_email_idx").on(sql`lower(${t.email})`)],
);

export const sessions = pgTable(
  "sessions",
  {
    // sha256 do token enviado no cookie — o token em si nunca é salvo
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const passwordResets = pgTable("password_resets", {
  id: text("id").primaryKey(), // sha256 do token
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Configurações do site (chave/valor)                                 */
/* ------------------------------------------------------------------ */

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Portfólio                                                           */
/* ------------------------------------------------------------------ */

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  sort: integer("sort").notNull().default(0),
  ...timestamps,
});

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    summary: text("summary"),
    description: text("description"),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    eventName: text("event_name"),
    eventDate: date("event_date"),
    location: text("location"),
    coverPhotoId: uuid("cover_photo_id"),
    visibility: projectVisibility("visibility").notNull().default("public"),
    passwordHash: text("password_hash"),
    watermark: boolean("watermark").notNull().default(false),
    featured: boolean("featured").notNull().default(false),
    published: boolean("published").notNull().default(false),
    isDemo: boolean("is_demo").notNull().default(false),
    sort: integer("sort").notNull().default(0),
    // dados da entrega para clientes
    clientStage: clientProjectStage("client_stage"),
    deliveryInfo: text("delivery_info"),
    deliveryDate: date("delivery_date"),
    ...timestamps,
  },
  (t) => [index("projects_category_idx").on(t.categoryId)],
);

export type PhotoVariant = { w: number; h: number; avif: string; webp: string };

export const uploadBatches = pgTable("upload_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const photos = pgTable(
  "photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    batchId: uuid("batch_id").references(() => uploadBatches.id, { onDelete: "set null" }),
    originalKey: text("original_key").notNull(),
    originalName: text("original_name").notNull(),
    mime: text("mime").notNull(),
    bytes: integer("bytes").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    variants: jsonb("variants").$type<PhotoVariant[]>().notNull().default([]),
    variantsWatermarked: boolean("variants_watermarked").notNull().default(false),
    blurDataUrl: text("blur_data_url"),
    dominantColor: text("dominant_color"),
    caption: text("caption"),
    alt: text("alt"),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    // legenda + alt + etiquetas, mantido pela aplicação para busca textual
    searchText: text("search_text").notNull().default(""),
    takenAt: timestamp("taken_at", { withTimezone: true }),
    // análise técnica local (sharp)
    dhash: text("dhash"),
    colorVector: jsonb("color_vector").$type<number[]>(),
    sharpness: real("sharpness"),
    brightness: real("brightness"),
    clippedHighlights: real("clipped_highlights"),
    clippedShadows: real("clipped_shadows"),
    qualityScore: real("quality_score"),
    // busca semântica (opcional, via API de embeddings)
    embedding: jsonb("embedding").$type<number[]>(),
    embeddingModel: text("embedding_model"),
    sort: integer("sort").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index("photos_project_idx").on(t.projectId, t.sort),
    index("photos_search_idx").using(
      "gin",
      sql`to_tsvector('portuguese'::regconfig, ${t.searchText})`,
    ),
  ],
);

/** Sugestões geradas por IA aguardando revisão humana. Nada é aplicado sem aprovação. */
export const aiSuggestions = pgTable("ai_suggestions", {
  id: uuid("id").primaryKey().defaultRandom(),
  photoId: uuid("photo_id")
    .notNull()
    .references(() => photos.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // "metadata"
  model: text("model").notNull(),
  payload: jsonb("payload").notNull(),
  status: text("status").notNull().default("pending"), // pending | accepted | rejected
  reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Coleções/seleções de trabalho (favoritas da fotógrafa, sequência narrativa etc.). */
export const collections = pgTable("collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  notes: text("notes"),
  photoIds: jsonb("photo_ids").$type<string[]>().notNull().default([]),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
});

/** Saídas das ferramentas de imagem. Sempre arquivos novos: o original nunca é sobrescrito. */
export const imageJobs = pgTable("image_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  photoId: uuid("photo_id")
    .notNull()
    .references(() => photos.id, { onDelete: "cascade" }),
  tool: text("tool").notNull(),
  provider: text("provider").notNull(), // local | replicate
  status: text("status").notNull().default("pending"), // pending | done | failed
  outputKey: text("output_key"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Acesso de clientes                                                  */
/* ------------------------------------------------------------------ */

export const projectAccess = pgTable(
  "project_access",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    // convite por e-mail: userId é vinculado quando a pessoa cria a conta
    email: text("email").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    canDownload: boolean("can_download").notNull().default(false),
    canShare: boolean("can_share").notNull().default(false),
    invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("project_access_unique").on(t.projectId, sql`lower(${t.email})`)],
);

export const favorites = pgTable(
  "favorites",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    photoId: uuid("photo_id")
      .notNull()
      .references(() => photos.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.photoId] })],
);

export const approvals = pgTable(
  "approvals",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    photoId: uuid("photo_id")
      .notNull()
      .references(() => photos.id, { onDelete: "cascade" }),
    status: text("status").notNull(), // approved | rejected
    comment: text("comment"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.photoId] })],
);

/** Links de compartilhamento com validade, para galerias não públicas. */
export const shareLinks = pgTable("share_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  tokenHash: text("token_hash").notNull().unique(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  label: text("label"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId)],
);

/* ------------------------------------------------------------------ */
/* Conteúdo institucional                                              */
/* ------------------------------------------------------------------ */

/** Serviços — também são as categorias selecionáveis no formulário de orçamento. */
export const services = pgTable("services", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  coverage: text("coverage"), // o que a cobertura inclui
  // preço definido pela fotógrafa; null = não divulgado
  priceFrom: numeric("price_from", { precision: 12, scale: 2 }),
  priceNote: text("price_note"),
  showPrice: boolean("show_price").notNull().default(false),
  active: boolean("active").notNull().default(true),
  sort: integer("sort").notNull().default(0),
  ...timestamps,
});

export const testimonials = pgTable("testimonials", {
  id: uuid("id").primaryKey().defaultRandom(),
  author: text("author").notNull(),
  context: text("context"),
  quote: text("quote").notNull(),
  published: boolean("published").notNull().default(false),
  sort: integer("sort").notNull().default(0),
  ...timestamps,
});

/** Base de conhecimento autorizada para o assistente virtual. */
export const knowledgeBase = pgTable("knowledge_base", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  published: boolean("published").notNull().default(true),
  ...timestamps,
});

export const blogPosts = pgTable("blog_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  excerpt: text("excerpt"),
  body: text("body").notNull(),
  coverPhotoId: uuid("cover_photo_id").references(() => photos.id, { onDelete: "set null" }),
  published: boolean("published").notNull().default(false),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  ...timestamps,
});

/* ------------------------------------------------------------------ */
/* Orçamentos                                                          */
/* ------------------------------------------------------------------ */

export type QuoteAttachment = { key: string; name: string; mime: string; bytes: number };

export const quoteRequests = pgTable(
  "quote_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(), // ex.: ORC-2026-7K3F9Q
    // cliente
    name: text("name").notNull(),
    email: text("email").notNull(),
    whatsapp: text("whatsapp").notNull(),
    city: text("city").notNull(),
    state: text("state").notNull(),
    contactPreference: text("contact_preference").notNull(),
    // serviço
    services: text("services").array().notNull(),
    // projeto
    eventDate: date("event_date"),
    altDate: date("alt_date"),
    location: text("location"),
    duration: text("duration"),
    participants: integer("participants"),
    description: text("description").notNull(),
    specificNeeds: text("specific_needs"),
    attachments: jsonb("attachments").$type<QuoteAttachment[]>().notNull().default([]),
    // comercial
    budgetRange: text("budget_range").notNull(),
    photoCount: text("photo_count"),
    deadline: text("deadline"),
    addons: text("addons").array().notNull().default(sql`'{}'::text[]`),
    extraInfo: text("extra_info"),
    // gestão
    status: quoteStatus("status").notNull().default("novo"),
    proposalValue: numeric("proposal_value", { precision: 12, scale: 2 }),
    validUntil: date("valid_until"),
    outcome: text("outcome"),
    archived: boolean("archived").notNull().default(false),
    // conformidade / antiabuso
    consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    source: text("source"), // página de origem
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    confirmationSentAt: timestamp("confirmation_sent_at", { withTimezone: true }),
    anonymizedAt: timestamp("anonymized_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("quote_status_idx").on(t.status),
    index("quote_created_idx").on(t.createdAt),
    index("quote_email_idx").on(sql`lower(${t.email})`),
  ],
);

export const quoteEvents = pgTable(
  "quote_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quoteRequests.id, { onDelete: "cascade" }),
    // note = observação interna | contact = registro de contato | status = mudança de status | system
    kind: text("kind").notNull(),
    channel: text("channel"), // whatsapp, email, telefone, reunião
    body: text("body").notNull(),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("quote_events_quote_idx").on(t.quoteId)],
);

export const quoteReminders = pgTable("quote_reminders", {
  id: uuid("id").primaryKey().defaultRandom(),
  quoteId: uuid("quote_id")
    .notNull()
    .references(() => quoteRequests.id, { onDelete: "cascade" }),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  note: text("note").notNull(),
  doneAt: timestamp("done_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ProposalItem = { description: string; amount: number };

export const proposals = pgTable("proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  quoteId: uuid("quote_id")
    .notNull()
    .references(() => quoteRequests.id, { onDelete: "cascade" }),
  number: text("number").notNull().unique(),
  title: text("title").notNull(),
  scope: text("scope").notNull(),
  hours: text("hours"),
  deliverables: text("deliverables").notNull(),
  deliveryDeadline: text("delivery_deadline").notNull(),
  items: jsonb("items").$type<ProposalItem[]>().notNull().default([]),
  total: numeric("total", { precision: 12, scale: 2 }).notNull(),
  paymentTerms: text("payment_terms").notNull(),
  validUntil: date("valid_until").notNull(),
  conditions: text("conditions"),
  status: text("status").notNull().default("rascunho"), // rascunho | enviada | aceita | recusada
  acceptTokenHash: text("accept_token_hash"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  acceptedName: text("accepted_name"),
  acceptedIpHash: text("accepted_ip_hash"),
  ...timestamps,
});

/* ------------------------------------------------------------------ */
/* Infraestrutura                                                      */
/* ------------------------------------------------------------------ */

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity"),
    entityId: text("entity_id"),
    meta: jsonb("meta"),
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)],
);

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
});

/** Registro de e-mails enviados (ou não enviados por falta de configuração). */
export const emailLog = pgTable("email_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  to: text("to").notNull(),
  subject: text("subject").notNull(),
  status: text("status").notNull(), // sent | skipped | failed
  provider: text("provider"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Mensagens do formulário da página Contato. */
export const contactMessages = pgTable("contact_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  message: text("message").notNull(),
  consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),
  ipHash: text("ip_hash"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
