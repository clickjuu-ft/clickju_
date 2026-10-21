"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, Loader2, MessageCircle, Paperclip, RotateCcw, X } from "lucide-react";
import {
  ATTACHMENT_ACCEPT,
  fieldErrors,
  MAX_ATTACHMENT_MB,
  MAX_ATTACHMENTS,
  STEPS,
  UFS,
  type QuoteFormValues,
} from "@/lib/quotes/schema";
import type { QuoteOptions } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Service = { slug: string; name: string; description: string | null };

type Values = {
  name: string;
  email: string;
  whatsapp: string;
  city: string;
  state: string;
  contactPreference: string;
  services: string[];
  eventDate: string;
  altDate: string;
  location: string;
  duration: string;
  participants: string;
  description: string;
  specificNeeds: string;
  budgetRange: string;
  photoCount: string;
  deadline: string;
  addons: string[];
  extraInfo: string;
  consent: boolean;
};

const EMPTY: Values = {
  name: "",
  email: "",
  whatsapp: "",
  city: "",
  state: "",
  contactPreference: "",
  services: [],
  eventDate: "",
  altDate: "",
  location: "",
  duration: "",
  participants: "",
  description: "",
  specificNeeds: "",
  budgetRange: "",
  photoCount: "",
  deadline: "",
  addons: [],
  extraInfo: "",
  consent: false,
};

const DRAFT_KEY = "orcamento-rascunho";
export const PREFILL_KEY = "orcamento-prefill"; // preenchido pelo assistente virtual

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function safeStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function QuoteForm({
  services,
  options,
  formToken,
  initialService,
  source,
  whatsapp,
  privacyHref = "/privacidade",
  turnstileSiteKey,
}: {
  services: Service[];
  options: QuoteOptions;
  formToken: string;
  initialService?: string;
  source?: string;
  whatsapp: string | null;
  privacyHref?: string;
  turnstileSiteKey?: string;
}) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Values>(() => ({
    ...EMPTY,
    services: initialService && services.some((s) => s.slug === initialService) ? [initialService] : [],
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<"idle" | "sending" | "error" | "done">("idle");
  const [serverError, setServerError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const honeypot = useRef<HTMLInputElement>(null);

  // restaura rascunho (sessão) e dados coletados pelo assistente
  useEffect(() => {
    const st = safeStorage();
    if (!st) return;
    const frame = requestAnimationFrame(() => {
      try {
        const prefill = st.getItem(PREFILL_KEY);
        const draft = st.getItem(DRAFT_KEY);
        const merged: Partial<Values> = { ...(draft ? JSON.parse(draft) : {}), ...(prefill ? JSON.parse(prefill) : {}) };
        const meaningful = Object.entries(merged).some(([k, v]) => k !== "consent" && (Array.isArray(v) ? v.length > 0 : typeof v === "string" && v.trim() !== ""));
        if (meaningful) {
          setValues((v) => ({
            ...v,
            ...merged,
            services: merged.services?.length ? merged.services.filter((s) => services.some((x) => x.slug === s)) : v.services,
            consent: false,
          }));
          setRestored(true);
        }
        st.removeItem(PREFILL_KEY);
      } catch {
        /* rascunho inválido: ignora */
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [services]);

  useEffect(() => {
    if (status === "done") return;
    const st = safeStorage();
    try {
      st?.setItem(DRAFT_KEY, JSON.stringify({ ...values, consent: false }));
    } catch {
      /* armazenamento indisponível */
    }
  }, [values, status]);

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) setErrors(({ [key]: _omit, ...rest }) => rest); // eslint-disable-line @typescript-eslint/no-unused-vars
  };

  const toggle = (key: "services" | "addons", value: string) =>
    set(key, values[key].includes(value) ? values[key].filter((x) => x !== value) : [...values[key], value]);

  const validateStep = (i: number) => {
    const res = STEPS[i].schema.safeParse(values as unknown as QuoteFormValues);
    let errs = res.success ? {} : fieldErrors(res.error);
    if (i === 2) {
      if (files.length > MAX_ATTACHMENTS) errs = { ...errs, attachments: `Máximo de ${MAX_ATTACHMENTS} arquivos.` };
      const big = files.find((f) => f.size > MAX_ATTACHMENT_MB * 1024 * 1024);
      if (big) errs = { ...errs, attachments: `“${big.name}” passa de ${MAX_ATTACHMENT_MB} MB.` };
    }
    setErrors(errs);
    if (Object.keys(errs).length) {
      requestAnimationFrame(() => {
        const first = document.querySelector<HTMLElement>("[aria-invalid='true']");
        first?.focus();
      });
      return false;
    }
    return true;
  };

  const goTo = (i: number) => {
    setStep(i);
    requestAnimationFrame(() => {
      headingRef.current?.focus();
      headingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const next = () => validateStep(step) && goTo(step + 1);
  const back = () => goTo(Math.max(0, step - 1));

  const submit = async () => {
    // valida todas as etapas antes de enviar
    for (let i = 0; i < STEPS.length; i++) {
      if (!validateStep(i)) {
        if (i !== step) goTo(i);
        return;
      }
    }
    setStatus("sending");
    setServerError(null);
    const fd = new FormData();
    for (const [k, v] of Object.entries(values)) {
      if (Array.isArray(v)) v.forEach((x) => fd.append(k, x));
      else fd.append(k, String(v));
    }
    files.forEach((f) => fd.append("attachments", f));
    fd.append("formToken", formToken);
    fd.append("website", honeypot.current?.value ?? "");
    if (source) fd.append("source", source);
    const turnstile = document.querySelector<HTMLInputElement>('[name="cf-turnstile-response"]')?.value;
    if (turnstile) fd.append("cf-turnstile-response", turnstile);
    try {
      const res = await fetch("/api/quotes", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; code?: string; error?: string; fields?: Record<string, string> };
      if (res.status === 201 && data.ok && data.code) {
        setCode(data.code);
        setStatus("done");
        safeStorage()?.removeItem(DRAFT_KEY);
        requestAnimationFrame(() => headingRef.current?.focus());
        return;
      }
      setStatus("error");
      setServerError(data.error ?? "Não foi possível enviar. Tente novamente.");
      if (data.fields) {
        setErrors(data.fields);
        const idx = STEPS.findIndex((s) => Object.keys(data.fields!).some((f) => f in s.schema.shape));
        if (idx >= 0 && idx !== step) goTo(idx);
      }
    } catch {
      setStatus("error");
      setServerError("Sem conexão com o servidor. Verifique sua internet e tente novamente — seus dados continuam aqui.");
    }
  };

  const serviceNames = useMemo(
    () => values.services.map((s) => services.find((x) => x.slug === s)?.name ?? s),
    [values.services, services],
  );

  /* ------------------------------- sucesso ------------------------------ */
  if (status === "done" && code) {
    const wa = whatsapp
      ? `${whatsapp}?text=${encodeURIComponent(`Olá! Acabei de enviar a solicitação de orçamento ${code} pelo site.`)}`
      : null;
    return (
      <div className="animate-fade-in border border-line p-8 md:p-14" role="status">
        <CheckCircle2 className="size-10 text-lilac" aria-hidden />
        <h2 ref={headingRef} tabIndex={-1} className="display mt-6 text-5xl outline-none md:text-6xl">
          Solicitação <span className="serif-accent text-lilac">recebida</span>
        </h2>
        <p className="mt-6 max-w-xl text-lg text-paper-2/80">
          Obrigado, {values.name.split(" ")[0]}! Seu pedido foi registrado com o código{" "}
          <strong className="font-mono text-paper">{code}</strong>. Vou analisar as informações e responder pessoalmente
          {values.contactPreference ? ` por ${values.contactPreference.toLowerCase()}` : ""}.
        </p>
        <p className="mt-3 text-sm text-mist">
          Valores e disponibilidade são confirmados somente na proposta. Guarde o código para referência.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-14 items-center justify-center gap-2 bg-violet px-8 text-xs font-semibold uppercase tracking-[0.14em] text-paper transition-colors hover:bg-lilac hover:text-ink"
            >
              <MessageCircle className="size-4" aria-hidden /> Continuar pelo WhatsApp
            </a>
          )}
          <Link
            href="/portfolio"
            className="inline-flex h-14 items-center justify-center border border-line-strong px-8 text-xs font-semibold uppercase tracking-[0.14em] hover:border-paper"
          >
            Ver portfólio
          </Link>
        </div>
      </div>
    );
  }

  /* ------------------------------ formulário ---------------------------- */
  const err = (k: string) =>
    errors[k] ? (
      <p id={`${k}-erro`} className="mt-2 flex items-center gap-1.5 text-sm text-danger" role="alert">
        <AlertCircle className="size-3.5 shrink-0" aria-hidden /> {errors[k]}
      </p>
    ) : null;
  const a11y = (k: string) => ({
    "aria-invalid": errors[k] ? (true as const) : undefined,
    "aria-describedby": errors[k] ? `${k}-erro` : undefined,
  });

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (step < STEPS.length - 1) next();
        else submit();
      }}
      aria-labelledby="etapa-titulo"
    >
      {/* honeypot: invisível para pessoas, atraente para robôs */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Site
          <input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      {/* progresso */}
      <div className="mb-10">
        <ol className="flex gap-1" aria-label="Etapas">
          {STEPS.map((s, i) => (
            <li key={s.id} className="flex-1">
              <button
                type="button"
                disabled={i > step}
                onClick={() => i < step && goTo(i)}
                aria-current={i === step ? "step" : undefined}
                className="group block w-full text-left disabled:cursor-default"
              >
                <span className={cn("block h-[3px] transition-colors duration-500", i <= step ? "bg-lilac" : "bg-line")} />
                <span
                  className={cn(
                    "mt-3 hidden text-[0.65rem] font-semibold uppercase tracking-[0.18em] sm:block",
                    i === step ? "text-paper" : i < step ? "text-mist group-hover:text-paper" : "text-mist/50",
                  )}
                >
                  {i < step && <Check className="mr-1 inline size-3" aria-hidden />}
                  {s.title}
                </span>
              </button>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-mist sm:hidden" aria-live="polite">
          Etapa {step + 1} de {STEPS.length} · {STEPS[step].title}
        </p>
        <div className="sr-only" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso do formulário" />
      </div>

      {restored && step === 0 && (
        <p className="mb-8 flex items-center justify-between gap-4 border border-line px-4 py-3 text-sm text-mist">
          Recuperamos as informações que você já tinha preenchido.
          <button
            type="button"
            className="inline-flex items-center gap-1 text-lilac hover:underline"
            onClick={() => {
              setValues({ ...EMPTY });
              setRestored(false);
            }}
          >
            <RotateCcw className="size-3.5" aria-hidden /> Limpar
          </button>
        </p>
      )}

      <h2 id="etapa-titulo" ref={headingRef} tabIndex={-1} className="display scroll-mt-28 text-4xl outline-none md:text-5xl">
        {STEPS[step].title}
      </h2>

      <div className="mt-10 animate-fade-in" key={step}>
        {step === 0 && (
          <div className="grid gap-8 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="name" className="label">Nome completo *</label>
              <input id="name" className="field" autoComplete="name" value={values.name} onChange={(e) => set("name", e.target.value)} {...a11y("name")} />
              {err("name")}
            </div>
            <div>
              <label htmlFor="email" className="label">E-mail *</label>
              <input id="email" type="email" inputMode="email" autoComplete="email" className="field" value={values.email} onChange={(e) => set("email", e.target.value)} {...a11y("email")} />
              {err("email")}
            </div>
            <div>
              <label htmlFor="whatsapp" className="label">WhatsApp com DDD *</label>
              <input
                id="whatsapp"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="(21) 91234-5678"
                className="field"
                value={values.whatsapp}
                onChange={(e) => set("whatsapp", maskPhone(e.target.value))}
                {...a11y("whatsapp")}
              />
              {err("whatsapp")}
            </div>
            <div>
              <label htmlFor="city" className="label">Cidade *</label>
              <input id="city" autoComplete="address-level2" className="field" value={values.city} onChange={(e) => set("city", e.target.value)} {...a11y("city")} />
              {err("city")}
            </div>
            <div>
              <label htmlFor="state" className="label">Estado *</label>
              <select id="state" autoComplete="address-level1" className="field" value={values.state} onChange={(e) => set("state", e.target.value)} {...a11y("state")}>
                <option value="">Selecione</option>
                {UFS.map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
              {err("state")}
            </div>
            <fieldset className="md:col-span-2" {...a11y("contactPreference")}>
              <legend className="label">Como prefere ser contatado(a)? *</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {options.contactPreferences.map((c) => (
                  <Chip key={c} type="radio" name="contactPreference" checked={values.contactPreference === c} onChange={() => set("contactPreference", c)}>
                    {c}
                  </Chip>
                ))}
              </div>
              {err("contactPreference")}
            </fieldset>
          </div>
        )}

        {step === 1 && (
          <fieldset {...a11y("services")}>
            <legend className="mb-6 text-paper-2/75">Selecione um ou mais serviços *</legend>
            <div className="grid gap-px bg-line sm:grid-cols-2">
              {services.map((s) => {
                const checked = values.services.includes(s.slug);
                return (
                  <label
                    key={s.slug}
                    className={cn(
                      "group relative flex cursor-pointer items-start gap-4 bg-ink p-5 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-lilac md:p-6",
                      checked ? "bg-ink-2" : "hover:bg-ink-2/60",
                    )}
                  >
                    <input type="checkbox" className="peer sr-only" checked={checked} onChange={() => toggle("services", s.slug)} />
                    <span
                      className={cn(
                        "mt-1 grid size-5 shrink-0 place-items-center border transition-colors",
                        checked ? "border-lilac bg-lilac text-ink" : "border-line-strong",
                      )}
                      aria-hidden
                    >
                      {checked && <Check className="size-3.5" strokeWidth={3} />}
                    </span>
                    <span>
                      <span className="block font-semibold uppercase tracking-[0.06em]">{s.name}</span>
                      {s.description && <span className="mt-1 block text-sm text-mist">{s.description}</span>}
                    </span>
                  </label>
                );
              })}
            </div>
            {err("services")}
          </fieldset>
        )}

        {step === 2 && (
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <label htmlFor="eventDate" className="label">Data do evento ou ensaio</label>
              <input id="eventDate" type="date" className="field" value={values.eventDate} onChange={(e) => set("eventDate", e.target.value)} {...a11y("eventDate")} />
              <p className="mt-1 text-xs text-mist">Deixe em branco se ainda não houver data.</p>
              {err("eventDate")}
            </div>
            <div>
              <label htmlFor="altDate" className="label">Data alternativa (opcional)</label>
              <input id="altDate" type="date" className="field" value={values.altDate} onChange={(e) => set("altDate", e.target.value)} {...a11y("altDate")} />
              {err("altDate")}
            </div>
            <div className="md:col-span-2">
              <label htmlFor="location" className="label">Local *</label>
              <input id="location" className="field" placeholder="Endereço, espaço ou cidade" value={values.location} onChange={(e) => set("location", e.target.value)} {...a11y("location")} />
              {err("location")}
            </div>
            <div>
              <label htmlFor="duration" className="label">Duração estimada</label>
              <select id="duration" className="field" value={values.duration} onChange={(e) => set("duration", e.target.value)} {...a11y("duration")}>
                <option value="">Selecione</option>
                {options.durations.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              {err("duration")}
            </div>
            <div>
              <label htmlFor="participants" className="label">Pessoas / participantes (se aplicável)</label>
              <input id="participants" type="number" inputMode="numeric" min={1} className="field" value={values.participants} onChange={(e) => set("participants", e.target.value)} {...a11y("participants")} />
              {err("participants")}
            </div>
            <div className="md:col-span-2">
              <label htmlFor="description" className="label">Descreva o serviço *</label>
              <textarea
                id="description"
                rows={5}
                className="field resize-y"
                placeholder="Conte sobre o evento ou ensaio, o objetivo das fotos e como você imagina o resultado."
                value={values.description}
                onChange={(e) => set("description", e.target.value)}
                {...a11y("description")}
              />
              <p className="mt-1 text-right text-xs text-mist">{values.description.trim().length}/4000</p>
              {err("description")}
            </div>
            <div className="md:col-span-2">
              <label htmlFor="specificNeeds" className="label">Necessidades específicas</label>
              <textarea id="specificNeeds" rows={3} className="field resize-y" placeholder="Acessibilidade, horários, restrições de imagem, momentos que não podem faltar…" value={values.specificNeeds} onChange={(e) => set("specificNeeds", e.target.value)} {...a11y("specificNeeds")} />
              {err("specificNeeds")}
            </div>
            <div className="md:col-span-2">
              <span className="label">Referências visuais ou anexos (opcional)</span>
              <div
                className={cn("mt-2 border border-dashed p-5 transition-colors", errors.attachments ? "border-danger" : "border-line-strong")}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  setFiles((f) => [...f, ...Array.from(e.dataTransfer.files)].slice(0, MAX_ATTACHMENTS + 1));
                }}
              >
                <input
                  ref={fileInput}
                  id="attachments"
                  type="file"
                  multiple
                  accept={ATTACHMENT_ACCEPT}
                  className="sr-only"
                  onChange={(e) => {
                    setFiles((f) => [...f, ...Array.from(e.target.files ?? [])].slice(0, MAX_ATTACHMENTS + 1));
                    e.target.value = "";
                    setErrors(({ attachments: _omit, ...rest }) => rest); // eslint-disable-line @typescript-eslint/no-unused-vars
                  }}
                  {...a11y("attachments")}
                />
                <label htmlFor="attachments" className="flex cursor-pointer items-center gap-3 text-sm text-paper-2/80 hover:text-paper">
                  <Paperclip className="size-4 text-lilac" aria-hidden />
                  Adicionar arquivos — JPG, PNG, WebP, HEIC ou PDF · até {MAX_ATTACHMENTS} arquivos de {MAX_ATTACHMENT_MB} MB
                </label>
                {files.length > 0 && (
                  <ul className="mt-4 space-y-2">
                    {files.map((f, i) => (
                      <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 border-t border-line pt-2 text-sm">
                        <span className="truncate">{f.name}</span>
                        <span className="flex shrink-0 items-center gap-3 text-xs text-mist">
                          {(f.size / 1024 / 1024).toFixed(1)} MB
                          <button type="button" className="grid size-8 place-items-center hover:text-danger" aria-label={`Remover ${f.name}`} onClick={() => setFiles((all) => all.filter((_, j) => j !== i))}>
                            <X className="size-4" />
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {err("attachments")}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-10">
            <fieldset {...a11y("budgetRange")}>
              <legend className="label">Faixa de investimento *</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {options.budgetRanges.map((b) => (
                  <Chip key={b} type="radio" name="budgetRange" checked={values.budgetRange === b} onChange={() => set("budgetRange", b)}>
                    {b}
                  </Chip>
                ))}
              </div>
              {err("budgetRange")}
            </fieldset>
            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <label htmlFor="photoCount" className="label">Quantidade aproximada de fotografias</label>
                <select id="photoCount" className="field" value={values.photoCount} onChange={(e) => set("photoCount", e.target.value)}>
                  <option value="">Selecione</option>
                  {options.photoCounts.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
                {err("photoCount")}
              </div>
              <div>
                <label htmlFor="deadline" className="label">Prazo esperado para entrega</label>
                <select id="deadline" className="field" value={values.deadline} onChange={(e) => set("deadline", e.target.value)}>
                  <option value="">Selecione</option>
                  {options.deadlines.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
                {err("deadline")}
              </div>
            </div>
            {options.addons.length > 0 && (
              <fieldset>
                <legend className="label">Produtos adicionais de interesse</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {options.addons.map((a) => (
                    <Chip key={a} type="checkbox" checked={values.addons.includes(a)} onChange={() => toggle("addons", a)}>
                      {a}
                    </Chip>
                  ))}
                </div>
                {err("addons")}
              </fieldset>
            )}
            <div>
              <label htmlFor="extraInfo" className="label">Informações complementares</label>
              <textarea id="extraInfo" rows={3} className="field resize-y" value={values.extraInfo} onChange={(e) => set("extraInfo", e.target.value)} {...a11y("extraInfo")} />
              {err("extraInfo")}
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <p className="text-paper-2/75">Confira os dados antes de enviar. Você pode voltar e editar qualquer etapa.</p>
            <dl className="mt-8 divide-y divide-line border-y border-line">
              {(
                [
                  [0, "Contato", `${values.name} · ${values.email} · ${values.whatsapp}`],
                  [0, "Cidade", `${values.city}/${values.state} · prefere ${values.contactPreference}`],
                  [1, "Serviços", serviceNames.join(", ")],
                  [2, "Datas", [values.eventDate && fmt(values.eventDate), values.altDate && `alternativa ${fmt(values.altDate)}`].filter(Boolean).join(" · ") || "A definir"],
                  [2, "Local", [values.location, values.duration, values.participants && `${values.participants} pessoas`].filter(Boolean).join(" · ")],
                  [2, "Descrição", values.description],
                  [2, "Necessidades", values.specificNeeds],
                  [2, "Anexos", files.map((f) => f.name).join(", ")],
                  [3, "Investimento", values.budgetRange],
                  [3, "Fotografias / prazo", [values.photoCount, values.deadline].filter(Boolean).join(" · ")],
                  [3, "Adicionais", values.addons.join(", ")],
                  [3, "Complementares", values.extraInfo],
                ] as [number, string, string][]
              )
                .filter(([, , v]) => v)
                .map(([s, k, v]) => (
                  <div key={k} className="grid gap-1 py-4 sm:grid-cols-[180px_1fr_auto] sm:gap-6">
                    <dt className="text-xs uppercase tracking-[0.16em] text-mist">{k}</dt>
                    <dd className="whitespace-pre-line break-words text-sm">{v}</dd>
                    <dd>
                      <button type="button" onClick={() => goTo(s)} className="text-xs uppercase tracking-[0.14em] text-lilac hover:underline">
                        Editar
                      </button>
                    </dd>
                  </div>
                ))}
            </dl>

            <div className="mt-8 border border-line bg-ink-2/50 p-5 text-sm text-paper-2/75">
              <p className="font-semibold text-paper">Privacidade e tratamento de dados</p>
              <p className="mt-2">
                Seus dados serão usados exclusivamente para responder a esta solicitação e elaborar uma proposta, conforme a
                Lei Geral de Proteção de Dados (LGPD). Não são compartilhados com terceiros para fins de marketing. Você pode
                pedir acesso, correção ou exclusão a qualquer momento. Leia a{" "}
                <Link href={privacyHref} target="_blank" className="text-lilac underline underline-offset-4">
                  Política de Privacidade
                </Link>
                .
              </p>
              <label className="mt-4 flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={values.consent}
                  onChange={(e) => set("consent", e.target.checked)}
                  className="mt-0.5 size-5 shrink-0 accent-violet"
                  {...a11y("consent")}
                />
                <span className="text-paper">Li e concordo com o tratamento dos meus dados para esta solicitação. *</span>
              </label>
              {err("consent")}
            </div>
            {turnstileSiteKey && (
              <>
                <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
                <div className="cf-turnstile mt-6" data-sitekey={turnstileSiteKey} data-theme="light" data-language="pt-br" />
              </>
            )}
          </div>
        )}
      </div>

      {status === "error" && serverError && (
        <div role="alert" className="mt-8 flex items-start gap-3 border border-danger/50 bg-danger/10 p-4 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
          <div>
            <p className="font-semibold text-paper">A solicitação não foi enviada.</p>
            <p className="mt-1 text-paper-2/80">{serverError}</p>
          </div>
        </div>
      )}

      <div className="mt-12 flex flex-col-reverse gap-3 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between">
        {step > 0 ? (
          <Button type="button" variant="ghost" onClick={back} disabled={status === "sending"} className="px-0">
            <ArrowLeft className="size-4" aria-hidden /> Voltar
          </Button>
        ) : (
          <span />
        )}
        {step < STEPS.length - 1 ? (
          <Button type="submit" size="lg">
            Continuar <ArrowRight className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button type="submit" variant="violet" size="lg" disabled={status === "sending"} aria-busy={status === "sending"}>
            {status === "sending" ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden /> Enviando…
              </>
            ) : status === "error" ? (
              <>
                <RotateCcw className="size-4" aria-hidden /> Tentar novamente
              </>
            ) : (
              "Enviar solicitação"
            )}
          </Button>
        )}
      </div>
    </form>
  );
}

function fmt(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function Chip({
  children,
  checked,
  onChange,
  type,
  name,
}: {
  children: React.ReactNode;
  checked: boolean;
  onChange: () => void;
  type: "radio" | "checkbox";
  name?: string;
}) {
  return (
    <label
      className={cn(
        "inline-flex min-h-11 cursor-pointer items-center gap-2 border px-4 text-sm transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-lilac",
        checked ? "border-lilac bg-lilac/15 text-paper" : "border-line-strong text-paper-2/80 hover:border-paper",
      )}
    >
      <input type={type} name={name} checked={checked} onChange={onChange} className="sr-only" />
      {checked && <Check className="size-3.5 text-lilac" aria-hidden />}
      {children}
    </label>
  );
}
