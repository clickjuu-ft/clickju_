import sharp from "sharp";
import { db, schema } from "@/lib/db";
import { hashPassword } from "@/lib/crypto";

export async function makeJpeg(w = 1600, h = 1000, color = "#8b5cf6") {
  return sharp({ create: { width: w, height: h, channels: 3, background: color } })
    .composite([{ input: Buffer.from(`<svg width="${w}" height="${h}"><circle cx="${w / 2}" cy="${h / 2}" r="${h / 3}" fill="#fff"/></svg>`) }])
    .jpeg()
    .toBuffer();
}

export async function makeUser(email: string, role: "admin" | "client" = "client") {
  const [u] = await db.insert(schema.users).values({ email, name: email.split("@")[0], role, passwordHash: await hashPassword("senha-teste-123") }).returning();
  return { id: u.id, email: u.email, name: u.name, role: u.role };
}

export async function seedServices() {
  await db.insert(schema.services).values([
    { slug: "fotografia-esportiva", name: "Fotografia esportiva", sort: 0 },
    { slug: "eventos-esportivos", name: "Eventos esportivos", sort: 1 },
    { slug: "inativo", name: "Inativo", active: false, sort: 2 },
  ]).onConflictDoNothing();
}

export function validQuote(overrides: Record<string, unknown> = {}) {
  const future = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
  return {
    name: "Maria Teste Silva",
    email: "Maria@Example.com",
    whatsapp: "(21) 98765-4321",
    city: "Rio de Janeiro",
    state: "RJ",
    contactPreference: "WhatsApp",
    services: ["fotografia-esportiva"],
    eventDate: future,
    location: "Aterro do Flamengo",
    participants: "300",
    description: "Cobertura de uma corrida de rua de 10 km com cerca de 300 participantes.",
    budgetRange: "Ainda não defini",
    addons: [],
    consent: true,
    ...overrides,
  };
}
