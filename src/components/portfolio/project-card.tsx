import Link from "next/link";
import { Picture } from "@/components/ui/picture";
import type { ProjectCard as Card } from "@/lib/portfolio";
import { cn, formatDate } from "@/lib/utils";

export function ProjectCard({
  project,
  sizes = "(min-width: 1024px) 50vw, 100vw",
  aspect = "aspect-[4/5]",
  priority,
  index,
}: {
  project: Card;
  sizes?: string;
  aspect?: string;
  priority?: boolean;
  index?: number;
}) {
  return (
    <Link href={`/portfolio/${project.slug}`} className="group block focus-visible:outline-offset-8">
      <div className={cn("relative overflow-hidden bg-ink-2", aspect)}>
        {project.cover ? (
          <Picture
            photo={project.cover}
            fill
            sizes={sizes}
            priority={priority}
            imgClassName="transition-transform duration-[1.4s] ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.04]"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-sm text-mist">Sem capa</div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-80 transition-opacity duration-700 group-hover:opacity-100" />
        {project.isDemo && (
          <span className="absolute left-3 top-3 bg-black/60 text-white px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-mist backdrop-blur">
            Demonstração
          </span>
        )}
      </div>
      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold uppercase stretch-semi tracking-tight transition-colors group-hover:text-lilac md:text-2xl">
            {project.title}
          </h3>
          <p className="mt-1 text-sm text-mist">
            {[project.category?.name, project.eventDate && formatDate(project.eventDate, { month: "short", year: "numeric" })]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {index !== undefined && <span className="text-xs tabular-nums text-mist">{String(index + 1).padStart(2, "0")}</span>}
      </div>
    </Link>
  );
}
