import { z } from "zod";

/**
 * Validação compartilhada do formulário de orçamento.
 * O navegador usa para feedback imediato; o servidor revalida tudo (fonte da verdade).
 */

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB",
  "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_MB = 10;
export const ATTACHMENT_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,application/pdf";

const trimmed = (min: number, max: number, msgMin: string) =>
  z
    .string()
    .trim()
    .min(min, msgMin)
    .max(max, `Use no máximo ${max} caracteres.`);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .optional()
    .transform((v) => (v ? v : undefined));

function todayISO() {
  // data local de São Paulo, formato AAAA-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

const futureDate = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida.")
  .refine((v) => !v || v >= todayISO(), "Escolha uma data a partir de hoje.");

export const clientStep = z.object({
  name: trimmed(3, 120, "Informe seu nome completo.").refine((v) => v.includes(" "), "Informe nome e sobrenome."),
  email: z.string().trim().toLowerCase().pipe(z.email("Informe um e-mail válido.")).pipe(z.string().max(160)),
  whatsapp: z
    .string()
    .transform((v) => v.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, ""))
    .refine((v) => /^[1-9]{2}9?\d{8}$/.test(v), "Informe o WhatsApp com DDD, ex.: (11) 91234-5678."),
  city: trimmed(2, 80, "Informe sua cidade."),
  state: z.enum(UFS, { error: "Selecione o estado." }),
  contactPreference: trimmed(2, 40, "Escolha como prefere ser contatado(a)."),
});

export const serviceStep = z.object({
  services: z.array(z.string().min(1).max(80)).min(1, "Selecione pelo menos um serviço.").max(12),
});

export const projectStep = z
  .object({
    eventDate: futureDate,
    altDate: futureDate,
    location: trimmed(2, 200, "Informe o local (ou cidade) do evento/ensaio."),
    duration: optionalText(60),
    participants: z
      .union([z.string(), z.number()])
      .optional()
      .transform((v) => (v === undefined || v === "" ? undefined : Number(v)))
      .refine((v) => v === undefined || (Number.isInteger(v) && v >= 1 && v <= 100000), "Informe um número válido."),
    description: trimmed(20, 4000, "Descreva o serviço com pelo menos 20 caracteres."),
    specificNeeds: optionalText(2000),
  })
  .refine((d) => !d.altDate || !d.eventDate || d.altDate !== d.eventDate, {
    path: ["altDate"],
    message: "A data alternativa deve ser diferente da principal.",
  });

export const commercialStep = z.object({
  budgetRange: trimmed(2, 60, "Selecione uma faixa de investimento (ou “Ainda não defini”)."),
  photoCount: optionalText(60),
  deadline: optionalText(60),
  addons: z.array(z.string().max(80)).max(20).default([]),
  extraInfo: optionalText(2000),
});

export const consentStep = z.object({
  consent: z.literal(true, { error: "É necessário concordar com o tratamento dos dados para enviar." }),
});

export const quoteSchema = z.object({
  ...clientStep.shape,
  ...serviceStep.shape,
  ...projectStep.shape,
  ...commercialStep.shape,
  ...consentStep.shape,
});

export type QuoteInput = z.output<typeof quoteSchema>;
export type QuoteFormValues = z.input<typeof quoteSchema>;

export const STEPS = [
  { id: "cliente", title: "Seus dados", schema: clientStep },
  { id: "servico", title: "Serviço", schema: serviceStep },
  { id: "projeto", title: "Projeto", schema: projectStep },
  { id: "comercial", title: "Investimento", schema: commercialStep },
  { id: "revisao", title: "Revisão", schema: consentStep },
] as const;

/** Converte erros do Zod em { campo: mensagem }. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export const QUOTE_STATUSES = [
  { value: "novo", label: "Novo pedido" },
  { value: "em_analise", label: "Em análise" },
  { value: "aguardando_info", label: "Aguardando informações" },
  { value: "preparando_proposta", label: "Preparando proposta" },
  { value: "proposta_enviada", label: "Proposta enviada" },
  { value: "em_negociacao", label: "Em negociação" },
  { value: "aprovado", label: "Aprovado" },
  { value: "recusado", label: "Recusado" },
  { value: "cancelado", label: "Cancelado" },
] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number]["value"];

export function statusLabel(s: string) {
  return QUOTE_STATUSES.find((x) => x.value === s)?.label ?? s;
}
