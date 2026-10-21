import { Picture } from "@/components/ui/picture";
import type { PhotoView } from "@/lib/photos";

/** Composição foto à esquerda + conteúdo à direita (login, contato, cadastro). */
export function SplitShell({ photo, children }: { photo: PhotoView | null; children: React.ReactNode }) {
  return (
    <div className="mx-auto grid min-h-[100svh] max-w-[1400px] items-center gap-12 px-5 pb-20 pt-28 md:grid-cols-2 md:gap-16 md:px-10 md:pt-32">
      <div className="hidden md:block">
        {photo ? <Picture photo={photo} sizes="50vw" className="aspect-[4/5]" /> : <div className="aspect-[4/5] bg-ink-2" />}
      </div>
      <div className="w-full max-w-md md:justify-self-start">{children}</div>
    </div>
  );
}
