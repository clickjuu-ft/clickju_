import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/forms/action-form";
import { SplitShell } from "@/components/site/split-shell";
import { requestPasswordReset } from "@/server/auth-actions";

export const metadata: Metadata = { title: "Recuperar senha", robots: { index: false } };

export default function ForgotPage() {
  return (
    <SplitShell photo={null}>
      <h1 className="text-5xl font-light tracking-tight">Recuperar senha</h1>
      <p className="mt-3 text-mist">Informe o e-mail da sua conta para receber um link de redefinição (válido por 1 hora).</p>
      <ActionForm action={requestPasswordReset} submitLabel="Enviar link" hideOnSuccess className="mt-10">
        <div>
          <label htmlFor="email" className="label">E-mail</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="field" />
        </div>
      </ActionForm>
      <p className="mt-8 text-sm">
        <Link href="/login" className="text-lilac hover:underline">Voltar para o login</Link>
      </p>
    </SplitShell>
  );
}
