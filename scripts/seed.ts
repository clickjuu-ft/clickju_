/**
 * Carga inicial: conta administrativa, categorias, serviços, configurações,
 * base de conhecimento e (opcionalmente) projetos DEMONSTRATIVOS.
 *
 *   npm run db:seed              → tudo, incluindo demonstração
 *   npm run db:seed -- --no-demo → sem projetos/fotos de demonstração
 *
 * Idempotente: pode ser executado novamente sem duplicar registros.
 * Executado com --conditions=react-server para reaproveitar os módulos do app.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { hashPassword } from "@/lib/crypto";
import { createPhotoFromUpload } from "@/lib/photos";
import { DEFAULT_QUOTE_OPTIONS, DEFAULT_SETTINGS, saveSetting } from "@/lib/settings";
import { renderDemo, type Scene } from "./demo-images";

// SEED_DEMO=false (ou --no-demo) pula os projetos de demonstração
const withDemo = !process.argv.includes("--no-demo") && process.env.SEED_DEMO !== "false";

const CATEGORIES = [
  ["fotografia-esportiva", "Fotografia esportiva", "Atletas, treinos e competições em alta velocidade."],
  ["corridas-e-competicoes", "Corridas e competições", "Corridas de rua, trilhas, provas e chegadas."],
  ["eventos", "Eventos", "Eventos sociais, corporativos e esportivos."],
  ["retratos-e-ensaios", "Retratos e ensaios", "Retratos individuais, ensaios e perfis."],
  ["marcas-e-ativacoes", "Marcas e ativações", "Ativações de marca, festivais e eventos patrocinados."],
  ["fotografia-editorial", "Fotografia editorial", "Imagens para revistas, marcas e publicações."],
  ["projetos-autorais", "Projetos autorais", "Pesquisas visuais e séries pessoais."],
] as const;

const SERVICES = [
  ["fotografia-esportiva", "Fotografia esportiva", "Cobertura de atletas, equipes, treinos e competições."],
  ["corridas-e-competicoes", "Corridas e competições", "Cobertura de provas, largada, percurso e chegada."],
  ["eventos-esportivos", "Eventos esportivos", "Torneios, campeonatos e eventos de marcas esportivas."],
  ["festas-e-eventos", "Festas e eventos", "Aniversários, celebrações e eventos sociais."],
  ["retratos-e-ensaios", "Retratos e ensaios", "Ensaios individuais, de casal, família ou atletas."],
  ["marcas-e-ativacoes", "Marcas e ativações", "Cobertura de ativações, festivais, lounges e eventos de marca."],
  ["fotografia-corporativa", "Fotografia corporativa", "Retratos profissionais, equipes e eventos empresariais."],
  ["fotografia-editorial", "Fotografia editorial", "Produções para revistas, campanhas e conteúdo de marca."],
  ["outros", "Outros", "Algo diferente? Descreva o que você precisa."],
] as const;

const KNOWLEDGE = [
  [
    "Como funciona a solicitação de orçamento",
    "O cliente preenche o formulário em /orcamento, sem precisar criar conta. A fotógrafa analisa o pedido e responde pessoalmente com uma proposta. Valores e disponibilidade só são confirmados pela fotógrafa.",
  ],
  [
    "Entrega das fotografias",
    "As fotografias são entregues em galeria online privada, acessada pela Área do Cliente. O prazo de entrega é combinado em cada proposta.",
  ],
  [
    "Galeria privada e seleção de favoritas",
    "Na Área do Cliente é possível marcar favoritas, aprovar fotografias e baixar os arquivos liberados pela fotógrafa.",
  ],
];

const DEMO_PROJECTS: {
  slug: string;
  title: string;
  category: string;
  summary: string;
  scenes: Scene[];
  featured?: boolean;
  visibility?: "public" | "password" | "private";
  watermark?: boolean;
}[] = [
  {
    slug: "linha-de-chegada",
    title: "Linha de chegada",
    category: "corridas-e-competicoes",
    summary: "Projeto demonstrativo: movimento, esforço e o último metro.",
    scenes: ["track", "track", "arena", "track", "portrait", "track"],
    featured: true,
  },
  {
    slug: "luz-de-arena",
    title: "Luz de arena",
    category: "fotografia-esportiva",
    summary: "Projeto demonstrativo: contraluz e atmosfera de grandes eventos.",
    scenes: ["arena", "stage", "arena", "arena", "track"],
    featured: true,
  },
  {
    slug: "retratos-em-sombra",
    title: "Retratos em sombra",
    category: "retratos-e-ensaios",
    summary: "Projeto demonstrativo: retratos de recorte e luz roxa.",
    scenes: ["portrait", "portrait", "portrait", "editorial"],
    featured: true,
  },
  {
    slug: "palco",
    title: "Palco",
    category: "eventos",
    summary: "Projeto demonstrativo: eventos e apresentações.",
    scenes: ["stage", "stage", "arena", "stage"],
  },
  {
    slug: "planos-de-luz",
    title: "Planos de luz",
    category: "fotografia-editorial",
    summary: "Projeto demonstrativo: composição editorial geométrica.",
    scenes: ["editorial", "editorial", "water", "editorial"],
    featured: true,
  },
  {
    slug: "mare",
    title: "Maré",
    category: "projetos-autorais",
    summary: "Projeto demonstrativo: série autoral em longa exposição.",
    scenes: ["water", "water", "water", "editorial"],
  },
  {
    slug: "galeria-protegida-exemplo",
    title: "Galeria protegida (exemplo)",
    category: "eventos",
    summary: "Exemplo de galeria protegida por senha, com marca-d'água.",
    scenes: ["stage", "arena", "portrait"],
    visibility: "password",
    watermark: true,
  },
];

async function main() {
  console.log("→ Configurações");
  const existingSite = await db.query.settings.findFirst({ where: eq(schema.settings.key, "site") });
  if (!existingSite) await saveSetting("site", DEFAULT_SETTINGS);
  const existingOpts = await db.query.settings.findFirst({ where: eq(schema.settings.key, "quote_options") });
  if (!existingOpts) await saveSetting("quote_options", DEFAULT_QUOTE_OPTIONS);

  console.log("→ Conta administrativa");
  const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@exemplo.com").toLowerCase();
  const admin = await db.query.users.findFirst({ where: sql`lower(${schema.users.email}) = ${adminEmail}` });
  if (!admin) {
    const password = process.env.ADMIN_PASSWORD ?? randomBytes(9).toString("base64url");
    await db.insert(schema.users).values({
      email: adminEmail,
      name: "Administração",
      role: "admin",
      passwordHash: await hashPassword(password),
    });
    console.log(`  ✓ Admin criado: ${adminEmail}`);
    if (!process.env.ADMIN_PASSWORD) console.log(`  ⚠ Senha gerada (anote, não será exibida novamente): ${password}`);
  } else {
    console.log(`  • Admin já existe: ${adminEmail}`);
  }

  console.log("→ Categorias e serviços");
  for (const [i, [slug, name, description]] of CATEGORIES.entries()) {
    await db.insert(schema.categories).values({ slug, name, description, sort: i }).onConflictDoNothing();
  }
  for (const [i, [slug, name, description]] of SERVICES.entries()) {
    await db.insert(schema.services).values({ slug, name, description, sort: i }).onConflictDoNothing();
  }
  const kbCount = await db.$count(schema.knowledgeBase);
  if (kbCount === 0) {
    for (const [title, content] of KNOWLEDGE) await db.insert(schema.knowledgeBase).values({ title, content });
  }

  if (!withDemo) {
    console.log("✓ Seed concluído (sem demonstração)");
    process.exit(0);
  }

  console.log("→ Projetos demonstrativos (gerando imagens — pode levar alguns minutos)");
  const cats = await db.query.categories.findMany();
  let seed = 1;
  for (const [i, p] of DEMO_PROJECTS.entries()) {
    const exists = await db.query.projects.findFirst({ where: eq(schema.projects.slug, p.slug) });
    if (exists) {
      console.log(`  • ${p.title} (já existe)`);
      continue;
    }
    const [project] = await db
      .insert(schema.projects)
      .values({
        slug: p.slug,
        title: p.title,
        summary: p.summary,
        description:
          "Este é um projeto de demonstração com imagens geradas por computador. Substitua-o pelo painel administrativo (Portfólio → Projetos) com suas fotografias, descrição e informações reais.",
        categoryId: cats.find((c) => c.slug === p.category)?.id,
        eventDate: new Date(Date.now() - (i + 1) * 21 * 86400_000).toISOString().slice(0, 10),
        visibility: p.visibility ?? "public",
        passwordHash: p.visibility === "password" ? await hashPassword("demo1234") : null,
        watermark: p.watermark ?? false,
        featured: p.featured ?? false,
        published: true,
        isDemo: true,
        sort: i,
      })
      .returning();
    const [batch] = await db
      .insert(schema.uploadBatches)
      .values({ projectId: project.id, name: "Lote demonstrativo" })
      .returning();
    for (const [j, scene] of p.scenes.entries()) {
      const orientation = scene === "portrait" || (j % 4 === 3 && scene !== "track") ? "portrait" : "landscape";
      const buffer = await renderDemo(scene, seed++, orientation);
      await createPhotoFromUpload({
        projectId: project.id,
        batchId: batch.id,
        buffer,
        originalName: `demo-${p.slug}-${j + 1}.jpg`,
        caption: null,
        alt: `Imagem demonstrativa do projeto ${p.title}`,
        tags: ["demonstração"],
      });
      process.stdout.write(".");
    }
    console.log(` ✓ ${p.title}`);
  }
  if (withDemo) console.log("  ℹ Senha da galeria protegida de exemplo: demo1234");

  // Imagem do hero e do "sobre" apontam para fotos de demonstração
  const site = (await db.query.settings.findFirst({ where: eq(schema.settings.key, "site") }))!.value as typeof DEFAULT_SETTINGS;
  if (!site.heroPhotoId || !site.aboutPhotoId) {
    const hero = await db.query.projects.findFirst({ where: eq(schema.projects.slug, "linha-de-chegada") });
    const about = await db.query.projects.findFirst({ where: eq(schema.projects.slug, "retratos-em-sombra") });
    await saveSetting("site", {
      ...site,
      heroPhotoId: site.heroPhotoId ?? hero?.coverPhotoId ?? null,
      aboutPhotoId: site.aboutPhotoId ?? about?.coverPhotoId ?? null,
    });
  }

  const posts = await db.$count(schema.blogPosts);
  if (posts === 0) {
    await db.insert(schema.blogPosts).values({
      slug: "post-de-exemplo",
      title: "Post de exemplo: como se preparar para um ensaio",
      excerpt: "Este é um post demonstrativo. Edite ou exclua no painel administrativo.",
      body: "Este conteúdo é apenas um exemplo para mostrar o layout do blog.\n\n## Escreva sobre o seu processo\n\nUse o blog para contar bastidores, dar dicas de preparação para ensaios e explicar como funcionam suas coberturas.\n\n## Formatação\n\nO editor aceita parágrafos, títulos com ## e listas simples com - no início da linha.\n\n- Item de exemplo\n- Outro item",
      published: true,
      publishedAt: new Date(),
    });
  }

  console.log("✓ Seed concluído");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
