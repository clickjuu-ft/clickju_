import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/forms/action-form";
import { SplitShell } from "@/components/site/split-shell";
import { register } from "@/server/auth-actions";
import { getSettings } from "@/lib/settings";
import { photoViewById } from "@/lib/portfolio";

export const metadata: Metadata = { title: "Criar conta", robots: { index: false } };

export default async function RegisterPage() {
  const s = await getSettings();
  return (
    <SplitShell photo={await photoViewById(s.aboutPhotoId)}>
      <h1 className="text-5xl font-light tracking-tight">Criar conta</h1>
      <p className="mt-3 text-mist">
        Use o mesmo e-mail informado na contratação: as galerias liberadas para ele aparecem automaticamente.
      </p>
      <ActionForm action={register} submitLabel="Criar conta" pendingLabel="Criando…" className="mt-10">
        <div>
          <label htmlFor="name" className="label">Nome completo</label>
          <input id="name" name="name" autoComplete="name" required className="field" />
        </div>
        <div>
          <label htmlFor="email" className="label">E-mail</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="field" />
        </div>
        <div>
          <label htmlFor="phone" className="label">Telefone (opcional)</label>
          <input id="phone" name="phone" type="tel" autoComplete="tel" className="field" />
        </div>
        <div>
          <label htmlFor="password" className="label">Senha</label>
          <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required className="field" aria-describedby="pw-hint" />
          <p id="pw-hint" className="mt-1 text-xs text-mist">Mínimo de 10 caracteres, com letras e números.</p>
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="consent" required className="mt-0.5 size-5 accent-violet" />
          <span>
            Li e aceito os <Link href="/termos" className="text-lilac underline">Termos de uso</Link> e a{" "}
            <Link href="/privacidade" className="text-lilac underline">Política de privacidade</Link>.
          </span>
        </label>
      </ActionForm>
      <p className="mt-8 text-sm text-mist">
        Já tem conta? <Link href="/login" className="text-lilac hover:underline">Entrar</Link>
      </p>
    </SplitShell>
  );
}
