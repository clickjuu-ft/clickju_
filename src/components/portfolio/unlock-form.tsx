"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { unlockGallery, type UnlockState } from "@/app/(site)/portfolio/[slug]/actions";
import { Button } from "@/components/ui/button";

export function UnlockForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState<UnlockState, FormData>(unlockGallery, {});
  const router = useRouter();
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);
  return (
    <form action={action} className="mx-auto mt-10 max-w-sm">
      <input type="hidden" name="projectId" value={projectId} />
      <label htmlFor="gallery-password" className="label flex items-center gap-2">
        <Lock className="size-3.5" aria-hidden /> Senha da galeria
      </label>
      <input
        id="gallery-password"
        name="password"
        type="password"
        required
        autoComplete="current-password"
        className="field"
        aria-invalid={!!state.error}
        aria-describedby={state.error ? "gallery-error" : undefined}
      />
      {state.error && (
        <p id="gallery-error" role="alert" className="mt-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" className="mt-6 w-full" disabled={pending}>
        {pending ? "Verificando…" : "Acessar galeria"}
      </Button>
    </form>
  );
}
