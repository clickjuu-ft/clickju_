/**
 * Gera imagens DEMONSTRATIVAS (composições abstratas) para o site funcionar
 * antes das fotografias reais serem enviadas. Todas levam a marcação "DEMO".
 * Substitua-as pelo painel administrativo.
 */
import sharp from "sharp";

type Rng = () => number;
function rng(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const P = { black: "#09090D", black2: "#15131C", purple: "#8B5CF6", lilac: "#A78BFA", white: "#F4F1FA" };

function frame(w: number, h: number, inner: string, defs = "") {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs>
  <radialGradient id="vig" cx="50%" cy="50%" r="75%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.75"/></radialGradient>
  <filter id="blur8" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="8"/></filter>
  <filter id="blur30" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="30"/></filter>
  <filter id="blur80" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="80"/></filter>
  ${defs}
</defs>
${inner}
<rect width="${w}" height="${h}" fill="url(#vig)"/>
<text x="${w - 36}" y="${h - 32}" text-anchor="end" font-family="DejaVu Sans, Arial" font-size="${Math.round(w / 90)}" letter-spacing="6" fill="#fff" fill-opacity="0.35">DEMO</text>
</svg>`;
}

/** Pista de atletismo em perspectiva com luz rasante e borrão de movimento. */
function track(w: number, h: number, r: Rng) {
  const vx = w * (0.35 + r() * 0.3);
  const vy = h * (0.3 + r() * 0.12);
  let lanes = "";
  for (let i = -8; i <= 8; i++) {
    const x2 = vx + i * w * 0.22;
    lanes += `<line x1="${vx}" y1="${vy}" x2="${x2}" y2="${h * 1.1}" stroke="${P.white}" stroke-opacity="${0.18 + (i % 2 === 0 ? 0.1 : 0)}" stroke-width="${3 + Math.abs(i)}"/>`;
  }
  let streaks = "";
  for (let i = 0; i < 26; i++) {
    const y = vy + r() * (h - vy);
    const len = w * (0.2 + r() * 0.6);
    const x = r() * w - len / 2;
    streaks += `<rect x="${x}" y="${y}" width="${len}" height="${2 + r() * 10}" fill="${r() > 0.5 ? P.lilac : P.white}" opacity="${0.08 + r() * 0.25}" filter="url(#blur8)"/>`;
  }
  // figura em movimento (silhueta estilizada)
  const fx = w * (0.25 + r() * 0.5);
  const fy = h * 0.78;
  const s = h * 0.36;
  const runner = `<g transform="translate(${fx} ${fy - s}) skewX(-12)" fill="${P.black}" opacity="0.92">
    <ellipse cx="${s * 0.12}" cy="${s * 0.08}" rx="${s * 0.065}" ry="${s * 0.075}"/>
    <path d="M ${s * 0.05} ${s * 0.18} L ${s * 0.2} ${s * 0.17} L ${s * 0.24} ${s * 0.5} L ${s * 0.42} ${s * 0.72} L ${s * 0.36} ${s * 0.76} L ${s * 0.16} ${s * 0.56} L ${-s * 0.12} ${s * 0.95} L ${-s * 0.2} ${s * 0.9} L ${s * 0.04} ${s * 0.5} Z"/>
    <path d="M ${s * 0.18} ${s * 0.22} L ${s * 0.42} ${s * 0.36} L ${s * 0.38} ${s * 0.4} L ${s * 0.16} ${s * 0.3} Z"/>
    <path d="M ${s * 0.08} ${s * 0.22} L ${-s * 0.14} ${s * 0.4} L ${-s * 0.1} ${s * 0.44} L ${s * 0.1} ${s * 0.3} Z"/>
  </g>`;
  const ghost = `<g opacity="0.25" filter="url(#blur8)" transform="translate(${-w * 0.04} 0)">${runner}</g>`;
  return frame(
    w,
    h,
    `<rect width="${w}" height="${h}" fill="url(#sky)"/>
     <circle cx="${vx}" cy="${vy}" r="${h * 0.25}" fill="${P.lilac}" opacity="0.5" filter="url(#blur80)"/>
     <rect y="${vy}" width="${w}" height="${h - vy}" fill="url(#ground)"/>
     ${lanes}${streaks}${ghost}${runner}`,
    `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.black}"/><stop offset="1" stop-color="#2a1b4d"/></linearGradient>
     <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b2470"/><stop offset="1" stop-color="${P.black2}"/></linearGradient>`,
  );
}

/** Luzes de estádio/arena: feixes e bokeh. */
function arena(w: number, h: number, r: Rng) {
  let beams = "";
  for (let i = 0; i < 6; i++) {
    const x = w * (0.1 + r() * 0.8);
    const spread = w * (0.15 + r() * 0.2);
    beams += `<polygon points="${x},0 ${x - spread},${h} ${x + spread},${h}" fill="${i % 2 ? P.purple : P.white}" opacity="${0.05 + r() * 0.08}" filter="url(#blur30)"/>`;
  }
  let bokeh = "";
  for (let i = 0; i < 70; i++) {
    const rr = 6 + r() * 60;
    bokeh += `<circle cx="${r() * w}" cy="${r() * h * 0.7}" r="${rr}" fill="${r() > 0.6 ? P.lilac : P.white}" opacity="${0.05 + r() * 0.35}" filter="url(#blur8)"/>`;
  }
  let crowd = "";
  for (let x = 0; x < w; x += 18 + r() * 22) {
    const hh = h * (0.12 + r() * 0.08);
    crowd += `<ellipse cx="${x}" cy="${h - hh}" rx="${16 + r() * 10}" ry="${20 + r() * 8}" fill="${P.black}"/><rect x="${x - 22}" y="${h - hh + 10}" width="46" height="${hh}" rx="18" fill="${P.black}"/>`;
  }
  return frame(w, h, `<rect width="${w}" height="${h}" fill="${P.black}"/>${beams}${bokeh}${crowd}`);
}

/** Retrato em silhueta com luz de recorte roxa. */
function portrait(w: number, h: number, r: Rng) {
  const cx = w * (0.4 + r() * 0.2);
  const s = Math.min(w, h);
  return frame(
    w,
    h,
    `<rect width="${w}" height="${h}" fill="url(#bg)"/>
     <circle cx="${cx + s * 0.18}" cy="${h * 0.38}" r="${s * 0.42}" fill="${P.purple}" opacity="0.55" filter="url(#blur80)"/>
     <g fill="${P.black}">
       <ellipse cx="${cx}" cy="${h * 0.4}" rx="${s * 0.12}" ry="${s * 0.155}"/>
       <path d="M ${cx - s * 0.055} ${h * 0.5} L ${cx + s * 0.055} ${h * 0.5} L ${cx + s * 0.07} ${h * 0.6} C ${cx + s * 0.3} ${h * 0.62} ${cx + s * 0.42} ${h * 0.7} ${cx + s * 0.46} ${h} L ${cx - s * 0.46} ${h} C ${cx - s * 0.42} ${h * 0.7} ${cx - s * 0.3} ${h * 0.62} ${cx - s * 0.07} ${h * 0.6} Z"/>
     </g>
     <path d="M ${cx + s * 0.13} ${h * 0.3} Q ${cx + s * 0.17} ${h * 0.4} ${cx + s * 0.12} ${h * 0.52}" stroke="${P.lilac}" stroke-width="${s * 0.008}" fill="none" opacity="0.9" filter="url(#blur8)"/>`,
    `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${P.black2}"/><stop offset="1" stop-color="${P.black}"/></linearGradient>`,
  );
}

/** Composição editorial geométrica: luz e sombra em planos. */
function editorial(w: number, h: number, r: Rng) {
  let planes = "";
  for (let i = 0; i < 7; i++) {
    const x = r() * w;
    const ww = w * (0.05 + r() * 0.25);
    planes += `<rect x="${x}" y="${-h * 0.2}" width="${ww}" height="${h * 1.4}" fill="${i % 3 === 0 ? P.lilac : P.white}" opacity="${0.04 + r() * 0.14}" transform="rotate(${18 + r() * 10} ${x} ${h / 2})"/>`;
  }
  const sun = `<circle cx="${w * (0.2 + r() * 0.6)}" cy="${h * (0.3 + r() * 0.3)}" r="${Math.min(w, h) * 0.12}" fill="${P.white}" opacity="0.9"/>`;
  return frame(
    w,
    h,
    `<rect width="${w}" height="${h}" fill="${P.black2}"/>${planes}${sun}<rect y="${h * 0.72}" width="${w}" height="${h * 0.28}" fill="${P.black}" opacity="0.8"/>`,
  );
}

/** Ondas/água em longa exposição. */
function water(w: number, h: number, r: Rng) {
  let waves = "";
  for (let i = 0; i < 22; i++) {
    const y = h * (0.35 + (i / 22) * 0.65);
    const amp = 10 + r() * 40;
    const len = w / (1 + r() * 3);
    let d = `M 0 ${y}`;
    for (let x = 0; x <= w; x += 40) d += ` L ${x} ${y + Math.sin((x / len) * Math.PI * 2 + i) * amp}`;
    waves += `<path d="${d}" stroke="${i % 3 ? P.lilac : P.white}" stroke-opacity="${0.08 + r() * 0.3}" stroke-width="${2 + r() * 6}" fill="none" filter="url(#blur8)"/>`;
  }
  return frame(
    w,
    h,
    `<rect width="${w}" height="${h}" fill="url(#sea)"/><circle cx="${w * 0.7}" cy="${h * 0.28}" r="${h * 0.08}" fill="${P.white}" opacity="0.85" filter="url(#blur8)"/>${waves}`,
    `<linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d1433"/><stop offset="0.4" stop-color="${P.black2}"/><stop offset="1" stop-color="${P.black}"/></linearGradient>`,
  );
}

/** Palco de evento com contraluz. */
function stage(w: number, h: number, r: Rng) {
  let spots = "";
  for (let i = 0; i < 5; i++) {
    const x = w * (0.15 + i * 0.18);
    spots += `<polygon points="${x},0 ${x - w * 0.12},${h * 0.8} ${x + w * 0.12},${h * 0.8}" fill="${i % 2 ? P.purple : P.lilac}" opacity="${0.1 + r() * 0.12}" filter="url(#blur30)"/>`;
  }
  let people = "";
  for (let i = 0; i < 4; i++) {
    const x = w * (0.25 + i * 0.16 + (r() - 0.5) * 0.05);
    const s = h * (0.42 + r() * 0.08);
    people += `<g fill="${P.black}"><ellipse cx="${x}" cy="${h * 0.8 - s}" rx="${s * 0.07}" ry="${s * 0.09}"/><path d="M ${x - s * 0.16} ${h * 0.8} L ${x - s * 0.12} ${h * 0.8 - s * 0.8} Q ${x} ${h * 0.8 - s * 0.88} ${x + s * 0.12} ${h * 0.8 - s * 0.8} L ${x + s * 0.16} ${h * 0.8} Z"/></g>`;
  }
  return frame(
    w,
    h,
    `<rect width="${w}" height="${h}" fill="${P.black}"/>${spots}<rect y="${h * 0.8}" width="${w}" height="${h * 0.2}" fill="${P.black2}"/>${people}
     <rect y="${h * 0.79}" width="${w}" height="6" fill="${P.lilac}" opacity="0.5" filter="url(#blur8)"/>`,
  );
}

export const SCENES = { track, arena, portrait, editorial, water, stage };
export type Scene = keyof typeof SCENES;

/** Renderiza uma cena em JPEG (como uma câmera entregaria), com grão de filme. */
export async function renderDemo(scene: Scene, seed: number, orientation: "landscape" | "portrait" = "landscape") {
  const [w, h] = orientation === "landscape" ? [2400, 1600] : [1600, 2400];
  const svg = SCENES[scene](w, h, rng(seed));
  const base = await sharp(Buffer.from(svg)).png().toBuffer();
  const r = rng(seed * 7 + 3);
  const noise = Buffer.alloc(w * h);
  for (let i = 0; i < noise.length; i++) noise[i] = 128 + Math.round((r() - 0.5) * 34);
  const grain = await sharp(noise, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();
  return sharp(base)
    .composite([{ input: grain, blend: "overlay" }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}
