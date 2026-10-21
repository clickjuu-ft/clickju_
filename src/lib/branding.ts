import "server-only";
import { storage } from "@/lib/storage";
import type { SiteSettings } from "@/lib/settings";

/** URLs das logos oficiais enviadas no painel (ou null para usar a marca recriada). */
export async function logoUrls(s: SiteSettings) {
  const sign = (k: string | null) => (k ? storage().signedUrl(k, { access: "public" }) : Promise.resolve(null));
  const [onDark, onLight, accent] = await Promise.all([sign(s.logoOnDarkKey), sign(s.logoOnLightKey), sign(s.logoAccentKey)]);
  return { onDark, onLight, accent };
}
