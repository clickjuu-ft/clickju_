import Link from "next/link";

export default function NotFound() {
  return (
    <main id="conteudo" className="grid min-h-dvh place-items-center px-5 text-center">
      <div>
        <p className="eyebrow">Erro 404</p>
        <h1 className="display mt-4 text-6xl md:text-8xl">Fora de <span className="serif-accent text-lilac">quadro</span></h1>
        <p className="mt-6 text-paper-2/75">A página que você procura não existe ou foi movida.</p>
        <div className="mt-10 flex justify-center gap-6 text-sm">
          <Link href="/" className="underline underline-offset-4">Início</Link>
          <Link href="/portfolio" className="underline underline-offset-4">Portfólio</Link>
          <Link href="/orcamento" className="underline underline-offset-4">Solicitar orçamento</Link>
        </div>
      </div>
    </main>
  );
}
