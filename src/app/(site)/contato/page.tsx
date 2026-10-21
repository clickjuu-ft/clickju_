import type { Metadata } from "next";
import Link from "next/link";
import { AtSign, Mail, MessageCircle } from "lucide-react";
import { getSettings, whatsappLink } from "@/lib/settings";
import { photoViewById } from "@/lib/portfolio";
import { issueFormToken } from "@/lib/quotes/service";
import { sendContact } from "@/server/contact-actions";
import { ActionForm } from "@/components/forms/action-form";
import { Picture } from "@/components/ui/picture";

export const metadata: Metadata = {
  title: "Contato",
  description: "Fale com a fotógrafa pelo formulário, WhatsApp, e-mail ou Instagram.",
  alternates: { canonical: "/contato" },
};

const pill =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full border border-paper/80 px-7 text-xs font-semibold uppercase tracking-[0.16em] transition-colors hover:bg-paper hover:text-ink";

export default async function ContactPage() {
  const s = await getSettings();
  const photo = await photoViewById(s.aboutPhotoId);
  const wa = whatsappLink(s.whatsapp, "Olá! Vim pelo site.");
  const waDigits = s.whatsapp.replace(/\D/g, "");
  return (
    <div className="mx-auto max-w-[1200px] px-5 pb-28 pt-32 md:px-10 md:pt-40">
      <div className="grid gap-12 md:grid-cols-2 md:gap-16">
        <div>{photo ? <Picture photo={photo} sizes="(min-width: 768px) 50vw, 100vw" className="aspect-square" /> : <div className="aspect-square bg-ink-2" />}</div>
        <div>
          <h1 className="serif-accent text-5xl md:text-6xl">Fale comigo</h1>
          <p className="mt-4 max-w-md text-paper-2/80">
            Preencha o formulário ou chame em um dos canais abaixo. Respondo pessoalmente. Para pedidos de cobertura, o{" "}
            <Link href="/orcamento" className="text-lilac underline underline-offset-4">formulário de orçamento</Link> é o caminho mais rápido.
          </p>
          <ActionForm action={sendContact} submitLabel="Enviar" hideOnSuccess className="mt-8 space-y-6" submitClassName="rounded-full px-10">
            <input type="hidden" name="formToken" value={issueFormToken()} />
            <div aria-hidden className="absolute -left-[9999px]"><input name="website" tabIndex={-1} autoComplete="off" /></div>
            <div><label htmlFor="c-name" className="sr-only">Nome</label><input id="c-name" name="name" placeholder="Nome" autoComplete="name" required className="field" /></div>
            <div><label htmlFor="c-email" className="sr-only">E-mail</label><input id="c-email" name="email" type="email" placeholder="E-mail" autoComplete="email" required className="field" /></div>
            <div><label htmlFor="c-phone" className="sr-only">Telefone (opcional)</label><input id="c-phone" name="phone" type="tel" placeholder="Telefone (opcional)" autoComplete="tel" className="field" /></div>
            <div><label htmlFor="c-msg" className="sr-only">Mensagem</label><textarea id="c-msg" name="message" placeholder="Mensagem" rows={6} required className="field resize-y" /></div>
            <label className="flex items-start gap-3 text-xs text-paper-2/80">
              <input type="checkbox" name="consent" className="mt-0.5 size-4 accent-violet" />
              <span>
                Ao enviar, concordo com o tratamento dos meus dados para responder a este contato, conforme a{" "}
                <Link href="/privacidade" className="underline">Política de privacidade</Link>.
              </span>
            </label>
          </ActionForm>
        </div>
      </div>

      <div className="mt-16 grid gap-4 border-t border-line pt-10 sm:grid-cols-3 sm:justify-items-center">
        {s.instagram && (
          <a className={pill} href={`https://instagram.com/${s.instagram}`} target="_blank" rel="noopener noreferrer">
            <AtSign className="size-4" aria-hidden /> Instagram
          </a>
        )}
        {wa && (
          <a className={pill} href={wa} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="size-4" aria-hidden /> WhatsApp
          </a>
        )}
        <a className={pill} href={`mailto:${s.email}`}>
          <Mail className="size-4" aria-hidden /> E-mail
        </a>
      </div>
      <p className="mt-8 text-center text-sm text-mist">
        {s.email}
        {waDigits.length >= 12 && <> · ({waDigits.slice(2, 4)}) {waDigits.slice(4, 9)}-{waDigits.slice(9)}</>} · {s.baseCity}
      </p>
    </div>
  );
}
