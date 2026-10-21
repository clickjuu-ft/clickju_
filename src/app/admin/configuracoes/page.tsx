import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { getQuoteOptions, getSettings } from "@/lib/settings";
import { logoUrls } from "@/lib/branding";
import { saveQuoteOptions, saveSiteSettings, uploadLogo } from "@/server/admin/content-actions";
import { changePassword } from "@/server/auth-actions";
import { ActionForm } from "@/components/forms/action-form";
import { PageHeader, Panel } from "@/components/admin/ui";
import { Logo } from "@/components/ui/logo";

export const metadata = { title: "Configurações" };

export default async function SettingsPage() {
  await requireAdmin();
  const [s, opts, logos] = await Promise.all([getSettings(), getQuoteOptions(), getSettings().then(logoUrls)]);
  const photos = await db
    .select({ id: schema.photos.id, name: schema.photos.originalName, w: schema.photos.width, h: schema.photos.height, project: schema.projects.title })
    .from(schema.photos)
    .innerJoin(schema.projects, eq(schema.projects.id, schema.photos.projectId))
    .orderBy(asc(schema.projects.title), asc(schema.photos.sort))
    .limit(2000);
  const photoSelect = (name: string, value: string | null, hint: string) => (
    <label className="block">
      <span className="label">{hint}</span>
      <select name={name} defaultValue={value ?? ""} className="input">
        <option value="">— nenhuma —</option>
        {photos.map((p) => (
          <option key={p.id} value={p.id}>
            {p.project} · {p.name} ({p.w > p.h ? "horizontal" : p.w < p.h ? "vertical" : "quadrada"})
          </option>
        ))}
      </select>
    </label>
  );
  const text = (name: keyof typeof s, label: string, rows = 0) => (
    <label className="block">
      <span className="label">{label}</span>
      {rows ? (
        <textarea name={name} rows={rows} defaultValue={String(s[name] ?? "")} className="input" />
      ) : (
        <input name={name} defaultValue={String(s[name] ?? "")} className="input" />
      )}
    </label>
  );
  const LOGO_SLOTS = [
    ["logoOnDarkKey", "Versão branca (cabeçalho sobre fotos e rodapé)", logos.onDark, "bg-[#09090D] text-white"],
    ["logoOnLightKey", "Versão preta (cabeçalho em fundo branco, documentos)", logos.onLight, "bg-white text-[#09090D]"],
    ["logoAccentKey", "Versão roxa (destaques, rodapé grande)", logos.accent, "bg-[#09090D] text-[#9900FF]"],
  ] as const;

  return (
    <>
      <PageHeader title="Configurações" description="Textos, imagens, contato, marca e opções do formulário. As alterações aparecem no site imediatamente." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Identidade e página inicial" className="xl:row-span-2">
          <ActionForm action={saveSiteSettings} submitLabel="Salvar configurações" className="space-y-4">
            {text("brandName", "Nome profissional")}
            {text("tagline", "Slogan")}
            <fieldset className="space-y-3 border-t border-line pt-4">
              <legend className="label">Hero</legend>
              {text("heroEyebrow", "Chamada pequena")}
              {text("heroTitle", "Título — 1ª linha")}
              {text("heroAccent", "Título — 2ª linha (em roxo)")}
              {text("heroText", "Texto de apresentação", 3)}
              {photoSelect("heroPhotoId", s.heroPhotoId, "Foto do hero no computador (prefira horizontal)")}
              {photoSelect("heroMobilePhotoId", s.heroMobilePhotoId, "Foto do hero no celular (opcional, prefira vertical)")}
            </fieldset>
            <fieldset className="space-y-3 border-t border-line pt-4">
              <legend className="label">Sobre mim</legend>
              {text("aboutTitle", "Título")}
              {text("aboutText", "Texto (parágrafos separados por linha em branco)", 8)}
              {photoSelect("aboutPhotoId", s.aboutPhotoId, "Foto da apresentação")}
            </fieldset>
            <fieldset className="space-y-3 border-t border-line pt-4">
              <legend className="label">Contato e redes</legend>
              {text("baseCity", "Cidade-base")}
              {text("email", "E-mail de contato (recebe notificações se NOTIFY_EMAIL não estiver definido)")}
              {text("whatsapp", "WhatsApp (DDI+DDD+número, ex.: 5521965947941)")}
              {text("instagram", "Instagram (sem @)")}
              <label className="block">
                <span className="label">Outras redes (uma por linha: Nome | https://…)</span>
                <textarea name="socials" rows={3} defaultValue={s.socials.map((x) => `${x.label} | ${x.url}`).join("\n")} className="input" />
              </label>
              {text("ctaTitle", "Chamada final — título")}
              {text("ctaText", "Chamada final — texto", 2)}
            </fieldset>
            <fieldset className="space-y-3 border-t border-line pt-4">
              <legend className="label">Marca-d’água das prévias</legend>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="wmEnabled" defaultChecked={s.watermark.enabled} className="accent-violet" /> Ativada (aplica-se aos projetos marcados com marca-d’água)</label>
              <div className="grid grid-cols-2 gap-3">
                <label><span className="label">Texto</span><input name="wmText" defaultValue={s.watermark.text} className="input" /></label>
                <label>
                  <span className="label">Posição</span>
                  <select name="wmPosition" defaultValue={s.watermark.position} className="input">
                    <option value="bottom-right">Canto inferior direito</option>
                    <option value="bottom-left">Canto inferior esquerdo</option>
                    <option value="center">Centro</option>
                    <option value="tiled">Repetida (mosaico)</option>
                  </select>
                </label>
                <label><span className="label">Opacidade (0,05–0,6)</span><input name="wmOpacity" type="number" step="0.01" min="0.05" max="0.6" defaultValue={s.watermark.opacity} className="input" /></label>
                <label><span className="label">Tamanho (0,1–0,6)</span><input name="wmScale" type="number" step="0.01" min="0.1" max="0.6" defaultValue={s.watermark.scale} className="input" /></label>
              </div>
              <p className="text-xs text-mist">A marca-d’água é aplicada somente às versões de visualização. Os arquivos originais nunca são alterados. Nenhuma técnica impede totalmente capturas de tela.</p>
            </fieldset>
            <fieldset className="space-y-3 border-t border-line pt-4">
              <legend className="label">SEO e privacidade</legend>
              {text("seoDescription", "Descrição para buscadores e redes sociais", 2)}
              {text("privacyContact", "Contato do encarregado de dados (LGPD)")}
              <label className="block"><span className="label">Retenção de pedidos encerrados (meses)</span><input name="retentionMonths" type="number" min={6} max={120} defaultValue={s.retentionMonths} className="input" /></label>
            </fieldset>
          </ActionForm>
        </Panel>

        <Panel title="Logos oficiais">
          <p className="mb-4 text-xs text-mist">Envie SVG (ideal) ou PNG/WebP com fundo transparente. Sem arquivo, o site usa a marca CLI/CKJU® recriada em tipografia.</p>
          <div className="space-y-5">
            {LOGO_SLOTS.map(([slot, label, url, preview]) => (
              <div key={slot} className="grid gap-3 sm:grid-cols-[140px_1fr] sm:items-center">
                <div className={`grid h-20 place-items-center p-3 ${preview}`}>
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="" className="max-h-full max-w-full" />
                  ) : (
                    <Logo className="text-xl" />
                  )}
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">{label}</p>
                  <ActionForm action={uploadLogo} submitLabel="Enviar" className="flex items-center gap-2 space-y-0 [&>button]:w-auto [&>button]:h-9">
                    <input type="hidden" name="slot" value={slot} />
                    <input type="file" name="file" accept="image/svg+xml,image/png,image/webp" className="text-xs" aria-label={label} />
                  </ActionForm>
                  {url && (
                    <ActionForm action={uploadLogo} submitLabel="Remover" className="mt-2 space-y-0 [&>button]:h-8 [&>button]:w-auto">
                      <input type="hidden" name="slot" value={slot} />
                      <input type="hidden" name="remove" value="1" />
                    </ActionForm>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Opções do formulário de orçamento">
          <p className="mb-4 text-xs text-mist">Uma opção por linha. Os serviços selecionáveis são gerenciados em “Serviços”.</p>
          <ActionForm action={saveQuoteOptions} submitLabel="Salvar opções" className="space-y-3">
            {(
              [
                ["budgetRanges", "Faixas de investimento", opts.budgetRanges],
                ["photoCounts", "Quantidade de fotografias", opts.photoCounts],
                ["deadlines", "Prazos de entrega", opts.deadlines],
                ["durations", "Durações", opts.durations],
                ["addons", "Produtos adicionais", opts.addons],
                ["contactPreferences", "Preferências de contato", opts.contactPreferences],
              ] as const
            ).map(([name, label, values]) => (
              <label key={name} className="block">
                <span className="label">{label}</span>
                <textarea name={name} rows={Math.min(7, values.length + 1)} defaultValue={values.join("\n")} className="input" />
              </label>
            ))}
          </ActionForm>
        </Panel>

        <Panel title="Minha senha">
          <ActionForm action={changePassword} submitLabel="Alterar senha" className="space-y-3">
            <input name="current" type="password" autoComplete="current-password" placeholder="Senha atual" className="input" aria-label="Senha atual" />
            <input name="password" type="password" autoComplete="new-password" placeholder="Nova senha (mín. 10, letras e números)" className="input" aria-label="Nova senha" />
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
