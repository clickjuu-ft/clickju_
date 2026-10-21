import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/forms/action-form";
import { SplitShell } from "@/components/site/split-shell";
import { resetPassword } from "@/server/auth-actions";

export const metadata: Metadata = { title: "Nova senha", robots: { index: false } };

export default async function ResetPage(props: PageProps<"/redefinir-senha">) {
  const sp = await props.searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  return (
    <SplitShell photo={null}>
      <h1 className="text-5xl font-light tracking-tight">Nova senha</h1>
      <ActionForm action={resetPassword} submitLabel="Salvar nova senha" hideOnSuccess className="mt-10">
        <input type="hidden" name="token" value={token} />
        <div>
          <label htmlFor="password" className="label">Nova senha</label>
          <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required className="field" />
        </div>
        <div>
          <label htmlFor="confirm" className="label">Confirmar senha</label>
          <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="field" />
        </div>
      </ActionForm>
      <p className="mt-8 text-sm">
        <Link href="/login" className="text-lilac hover:underline">Ir para o login</Link>
      </p>
    </SplitShell>
  );
}
