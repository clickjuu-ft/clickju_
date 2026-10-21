import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/forms/action-form";
import { SplitShell } from "@/components/site/split-shell";
import { login } from "@/server/auth-actions";
import { getCurrentUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { photoViewById } from "@/lib/portfolio";

export const metadata: Metadata = { title: "Entrar", robots: { index: false } };

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const next = typeof sp.next === "string" ? sp.next : "";
  const user = await getCurrentUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/cliente");
  const s = await getSettings();
  return (
    <SplitShell photo={await photoViewById(s.aboutPhotoId)}>
      <h1 className="text-5xl font-light tracking-tight">Entrar</h1>
      <p className="mt-3 text-mist">Área do cliente e painel administrativo.</p>
      <ActionForm action={login} submitLabel="Entrar" pendingLabel="Entrando…" className="mt-10">
        <input type="hidden" name="next" value={next} />
        <div>
          <label htmlFor="email" className="label">E-mail</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="field" />
        </div>
        <div>
          <label htmlFor="password" className="label">Senha</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required className="field" />
        </div>
      </ActionForm>
      <div className="mt-8 flex justify-between text-sm">
        <Link href="/recuperar-senha" className="text-mist underline-offset-4 hover:text-paper hover:underline">
          Esqueci minha senha
        </Link>
        <Link href="/cadastro" className="text-lilac underline-offset-4 hover:underline">
          Criar conta de cliente
        </Link>
      </div>
    </SplitShell>
  );
}
