"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, Copy, Loader2, Plus, Trash2 } from "lucide-react";
import { saveProposal, sendProposal } from "@/server/admin/proposal-actions";
import type { FormState } from "@/server/auth-actions";
import { SubmitButton } from "@/components/admin/ui";
import { formatBRL } from "@/lib/utils";

type P = {
  id: string;
  title: string;
  scope: string;
  hours: string | null;
  deliverables: string;
  deliveryDeadline: string;
  items: { description: string; amount: number }[];
  total: string;
  paymentTerms: string;
  validUntil: string;
  conditions: string | null;
  status: string;
};

const toInput = (n: number | string) => (Number(n) ? Number(n).toFixed(2).replace(".", ",") : "");

export function ProposalEditor({ p }: { p: P }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveProposal, {});
  const [sendState, send, sending] = useActionState<FormState & { link?: string }, FormData>(sendProposal, {});
  const [items, setItems] = useState(p.items.length ? p.items.map((i) => ({ d: i.description, a: toInput(i.amount) })) : [{ d: "", a: "" }]);
  const [copied, setCopied] = useState(false);
  const locked = p.status === "aceita";
  const sum = items.reduce((s, i) => s + (Number(i.a.replace(/\./g, "").replace(",", ".")) || 0), 0);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
      <form action={action} className="space-y-5 border border-line bg-ink p-5">
        <input type="hidden" name="id" value={p.id} />
        <fieldset disabled={locked} className="space-y-5">
          <label className="block">
            <span className="label">Título / serviço proposto</span>
            <input name="title" defaultValue={p.title} required className="input" />
          </label>
          <label className="block">
            <span className="label">Escopo da cobertura</span>
            <textarea name="scope" rows={5} defaultValue={p.scope} required className="input" />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="label">Horas previstas</span>
              <input name="hours" defaultValue={p.hours ?? ""} className="input" placeholder="Ex.: 4 horas" />
            </label>
            <label className="block">
              <span className="label">Prazo de entrega</span>
              <input name="deliveryDeadline" defaultValue={p.deliveryDeadline} required className="input" placeholder="Ex.: até 10 dias úteis" />
            </label>
          </div>
          <label className="block">
            <span className="label">Entregáveis</span>
            <textarea name="deliverables" rows={3} defaultValue={p.deliverables} required className="input" />
          </label>

          <div>
            <span className="label">Itens (opcional)</span>
            <ul className="space-y-2">
              {items.map((it, i) => (
                <li key={i} className="grid grid-cols-[1fr_140px_auto] gap-2">
                  <input name="itemDescription" value={it.d} onChange={(e) => setItems((all) => all.map((x, j) => (j === i ? { ...x, d: e.target.value } : x)))} className="input" placeholder="Descrição" aria-label={`Descrição do item ${i + 1}`} />
                  <input name="itemAmount" value={it.a} inputMode="decimal" onChange={(e) => setItems((all) => all.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} className="input text-right" placeholder="0,00" aria-label={`Valor do item ${i + 1}`} />
                  <button type="button" onClick={() => setItems((all) => all.filter((_, j) => j !== i))} className="grid size-9 place-items-center text-mist hover:text-danger" aria-label={`Remover item ${i + 1}`}>
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => setItems((all) => [...all, { d: "", a: "" }])} className="mt-2 inline-flex items-center gap-1 text-xs text-lilac hover:underline">
              <Plus className="size-3.5" /> Adicionar item
            </button>
            {sum > 0 && <p className="mt-2 text-xs text-mist">Soma dos itens: {formatBRL(sum)}</p>}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="label">Valor total (R$)</span>
              <input name="total" defaultValue={toInput(p.total)} inputMode="decimal" className="input" placeholder="Vazio = soma dos itens" />
            </label>
            <label className="block">
              <span className="label">Validade da proposta</span>
              <input type="date" name="validUntil" defaultValue={p.validUntil} required className="input" />
            </label>
          </div>
          <label className="block">
            <span className="label">Condições de pagamento</span>
            <textarea name="paymentTerms" rows={2} defaultValue={p.paymentTerms} required className="input" placeholder="Ex.: 50% na reserva da data e 50% na entrega, via Pix." />
          </label>
          <label className="block">
            <span className="label">Condições adicionais</span>
            <textarea name="conditions" rows={4} defaultValue={p.conditions ?? ""} className="input" placeholder="Deslocamento, horas extras, uso de imagem, cancelamento…" />
          </label>
        </fieldset>
        {state.error && (
          <p role="alert" className="flex items-center gap-2 text-sm text-danger">
            <AlertCircle className="size-4" /> {state.error}
          </p>
        )}
        {state.ok && (
          <p role="status" className="flex items-center gap-2 text-sm text-ok">
            <CheckCircle2 className="size-4" /> {state.message}
          </p>
        )}
        {!locked && (
          <SubmitButton disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />} Salvar proposta
          </SubmitButton>
        )}
      </form>

      <div className="space-y-6">
        <section className="border border-line bg-ink p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-mist">PDF</h2>
          <a href={`/api/admin/proposals/${p.id}/pdf`} target="_blank" className="inline-flex h-9 items-center bg-paper px-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink hover:bg-violet hover:text-white">
            Gerar / baixar PDF
          </a>
          <p className="mt-2 text-xs text-mist">Salve antes de gerar para incluir as últimas alterações.</p>
        </section>
        {!locked && (
          <section className="border border-line bg-ink p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-mist">Enviar ao cliente</h2>
            <form action={send} className="space-y-3">
              <input type="hidden" name="id" value={p.id} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="email" defaultChecked className="accent-violet" /> Enviar por e-mail (se configurado)
              </label>
              <SubmitButton variant="violet" disabled={sending}>
                {sending && <Loader2 className="size-4 animate-spin" />} {p.status === "enviada" ? "Gerar novo link e reenviar" : "Marcar como enviada e gerar link"}
              </SubmitButton>
            </form>
            {sendState.error && <p className="mt-3 text-sm text-danger">{sendState.error}</p>}
            {sendState.ok && (
              <div className="mt-4 space-y-2 text-sm" role="status">
                <p className="text-ok">{sendState.message}</p>
                {sendState.link && (
                  <>
                    <p className="text-xs text-mist">Link de aceite (copie agora; por segurança ele não é exibido novamente):</p>
                    <div className="flex gap-2">
                      <input readOnly value={sendState.link} className="input font-mono text-xs" onFocus={(e) => e.target.select()} />
                      <button type="button" className="grid size-9 shrink-0 place-items-center border border-line-strong" aria-label="Copiar link" onClick={async () => { await navigator.clipboard.writeText(sendState.link!); setCopied(true); }}>
                        <Copy className="size-4" />
                      </button>
                    </div>
                    {copied && <p className="text-xs text-ok">Copiado.</p>}
                  </>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
