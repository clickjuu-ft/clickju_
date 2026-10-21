import { cn } from "@/lib/utils";

export function SectionHeading({
  index,
  eyebrow,
  title,
  accent,
  className,
  children,
}: {
  index?: string;
  eyebrow: string;
  title: string;
  accent?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-6 md:flex-row md:items-end md:justify-between", className)}>
      <div>
        <p className="eyebrow flex items-center gap-3">
          {index && <span className="text-mist">{index}</span>}
          <span className="h-px w-8 bg-lilac/60" aria-hidden />
          {eyebrow}
        </p>
        <h2 className="display mt-4 text-5xl md:text-7xl">
          {title} {accent && <span className="serif-accent text-lilac">{accent}</span>}
        </h2>
      </div>
      {children}
    </div>
  );
}
