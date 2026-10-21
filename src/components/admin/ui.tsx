import { cn } from "@/lib/utils";

export function PageHeader({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-3xl font-extrabold uppercase tracking-tight [font-stretch:80%]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-mist">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Panel({ title, children, className, actions }: { title?: string; children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  return (
    <section className={cn("border border-line bg-ink p-5", className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-mist">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="border border-line bg-ink p-5">
      <p className="text-xs uppercase tracking-[0.14em] text-mist">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-mist">{hint}</p>}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  novo: "bg-violet text-white",
  em_analise: "bg-violet/15 text-lilac",
  aguardando_info: "bg-amber-100 text-amber-800",
  preparando_proposta: "bg-sky-100 text-sky-800",
  proposta_enviada: "bg-indigo-100 text-indigo-800",
  em_negociacao: "bg-fuchsia-100 text-fuchsia-800",
  aprovado: "bg-emerald-100 text-emerald-800",
  recusado: "bg-rose-100 text-rose-800",
  cancelado: "bg-neutral-200 text-neutral-700",
};

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span className={cn("inline-flex whitespace-nowrap px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.08em]", STATUS_STYLES[status] ?? "bg-ink-2")}>
      {label}
    </span>
  );
}

export function SubmitButton({ children, className, variant = "dark", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "dark" | "violet" | "ghost" | "danger" }) {
  return (
    <button
      {...rest}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 px-4 text-xs font-semibold uppercase tracking-[0.12em] transition-colors disabled:opacity-50",
        variant === "dark" && "bg-paper text-ink hover:bg-violet hover:text-white",
        variant === "violet" && "bg-violet text-white hover:bg-lilac",
        variant === "ghost" && "border border-line-strong hover:border-paper",
        variant === "danger" && "border border-danger/50 text-danger hover:bg-danger hover:text-white",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="border border-dashed border-line-strong p-8 text-center text-sm text-mist">{children}</p>;
}
