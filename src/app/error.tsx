"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="conteudo" className="grid min-h-dvh place-items-center px-5 text-center">
      <div>
        <p className="eyebrow">Algo deu errado</p>
        <h1 className="display mt-4 text-5xl md:text-7xl">Erro inesperado</h1>
        <p className="mt-6 text-paper-2/75">Tente novamente. Se o problema continuar, fale pelo WhatsApp ou e-mail.</p>
        <button onClick={reset} className="mt-8 h-12 bg-paper px-8 text-xs font-semibold uppercase tracking-[0.14em] text-ink">
          Tentar novamente
        </button>
      </div>
    </main>
  );
}
