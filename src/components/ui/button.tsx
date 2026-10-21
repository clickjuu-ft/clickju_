import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "outline" | "ghost" | "violet" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "group relative inline-flex items-center justify-center gap-2 font-semibold uppercase tracking-[0.14em] transition-[background,color,border-color,transform] duration-300 ease-[cubic-bezier(.16,1,.3,1)] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] select-none";

const variants: Record<Variant, string> = {
  primary: "bg-paper text-ink hover:bg-lilac",
  violet: "bg-violet text-paper hover:bg-lilac hover:text-ink",
  outline: "border border-line-strong text-paper hover:border-paper hover:bg-paper hover:text-ink",
  ghost: "text-paper-2 hover:text-lilac",
  danger: "border border-danger/50 text-danger hover:bg-danger hover:text-ink",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-[0.68rem]",
  md: "h-12 px-6 text-[0.72rem]",
  lg: "h-14 px-8 text-xs",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

type CommonProps = { variant?: Variant; size?: Size; arrow?: boolean; className?: string; children: React.ReactNode };

export function ButtonLink({
  href,
  variant,
  size,
  arrow,
  className,
  children,
  ...rest
}: CommonProps & { href: string } & Omit<React.ComponentProps<typeof Link>, "href" | "className">) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...rest}>
      <span>{children}</span>
      {arrow && (
        <ArrowUpRight
          aria-hidden
          className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
        />
      )}
    </Link>
  );
}

export function Button({
  variant,
  size,
  arrow,
  className,
  children,
  ...rest
}: CommonProps & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className">) {
  return (
    <button className={buttonClass(variant, size, className)} {...rest}>
      <span className="inline-flex items-center gap-2">{children}</span>
      {arrow && (
        <ArrowUpRight
          aria-hidden
          className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
        />
      )}
    </button>
  );
}
