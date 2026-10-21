import { cn } from "@/lib/utils";

/**
 * Marca Clickju recriada em tipografia (CLI / CKJU®), herdando a cor do texto.
 * Se a logo oficial for enviada no painel (Configurações → Logo), ela é usada no lugar.
 */
export function Logo({
  className,
  variant = "stacked",
  src,
  label = "Clickju",
}: {
  className?: string;
  variant?: "stacked" | "inline";
  src?: string | null;
  label?: string;
}) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={label} className={cn("h-full w-auto object-contain", className)} />;
  }
  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        "inline-flex select-none font-black uppercase leading-[0.8] tracking-[-0.045em] [font-stretch:100%]",
        variant === "stacked" ? "flex-col" : "flex-row items-baseline",
        className,
      )}
    >
      <span aria-hidden>CLI</span>
      <span aria-hidden className="relative">
        CKJU
        <span className="absolute -right-[0.42em] bottom-[0.06em] text-[0.24em] font-semibold leading-none tracking-normal">®</span>
      </span>
    </span>
  );
}
