"use client";

import { useActionState } from "react";
import type { FormState } from "@/server/auth-actions";
import { SubmitButton } from "@/components/admin/ui";

export function ShareLinkForm({
  projectId,
  action,
}: {
  projectId: string;
  action: (prev: FormState & { link?: string }, fd: FormData) => Promise<FormState & { link?: string }>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="projectId" value={projectId} />
      <input name="label" placeholder="Identificação (ex.: assessoria do evento)" className="input" aria-label="Identificação" />
      <select name="days" className="input" defaultValue="30" aria-label="Validade">
        <option value="1">1 dia</option>
        <option value="7">7 dias</option>
        <option value="30">30 dias</option>
        <option value="0">Sem prazo</option>
      </select>
      <SubmitButton variant="ghost" disabled={pending}>Criar link</SubmitButton>
      {state.link && (
        <div className="space-y-1" role="status">
          <p className="text-xs text-ok">{state.message}</p>
          <input readOnly value={state.link} onFocus={(e) => e.target.select()} className="input font-mono text-xs" aria-label="Link criado" />
        </div>
      )}
    </form>
  );
}
