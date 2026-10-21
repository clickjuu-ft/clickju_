"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import type { FormState } from "@/server/auth-actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Formulário genérico para server actions: estados de envio, erro e sucesso acessíveis. */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Enviando…",
  className,
  hideOnSuccess = false,
  variant = "primary",
  submitClassName,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  children: React.ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  hideOnSuccess?: boolean;
  variant?: "primary" | "violet";
  submitClassName?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  if (hideOnSuccess && state.ok) {
    return (
      <p role="status" className="flex items-start gap-3 border border-line p-5 text-sm">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden /> {state.message}
      </p>
    );
  }
  return (
    <form action={formAction} className={cn("space-y-7", className)} noValidate>
      {children}
      {state.fields && Object.keys(state.fields).length > 0 && (
        <ul className="space-y-1 text-sm text-danger" role="alert">
          {Object.entries(state.fields).map(([k, v]) => (
            <li key={k}>{v}</li>
          ))}
        </ul>
      )}
      {state.error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {state.error}
        </p>
      )}
      {state.ok && state.message && (
        <p role="status" className="flex items-start gap-2 text-sm text-ok">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden /> {state.message}
        </p>
      )}
      <Button type="submit" variant={variant} size="lg" className={submitClassName ?? "w-full"} disabled={pending} aria-busy={pending}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden /> {pendingLabel}
          </>
        ) : (
          submitLabel
        )}
      </Button>
    </form>
  );
}
