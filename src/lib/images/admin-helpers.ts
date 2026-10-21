import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { regenerateVariants } from "@/lib/photos";

export { inspect, extForFormat, mimeForFormat } from "@/lib/images/process";

/** Reaplica a marca-d'água (nova configuração) às fotos de projetos que a utilizam. */
export async function regenerateVariantsSafe() {
  const projects = await db.query.projects.findMany({ where: eq(schema.projects.watermark, true), columns: { id: true } });
  if (!projects.length) return 0;
  const photos = await db.query.photos.findMany({ where: inArray(schema.photos.projectId, projects.map((p) => p.id)), columns: { id: true } });
  return regenerateVariants(photos.map((p) => p.id));
}
