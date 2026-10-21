import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Termos de uso", alternates: { canonical: "/termos" } };

export default async function TermsPage() {
  const s = await getSettings();
  return (
    <article className="mx-auto max-w-3xl px-5 pb-28 pt-32 md:pt-40">
      <p className="eyebrow">Documento</p>
      <h1 className="display mt-4 text-5xl md:text-7xl">Termos de uso</h1>
      <p className="mt-4 text-sm text-mist">Modelo base. Recomenda-se revisão por assessoria jurídica.</p>
      <div className="prose-site mt-10">
        <h2>1. Direitos autorais</h2>
        <p>
          Todas as fotografias exibidas neste site são obras protegidas pela Lei nº 9.610/1998 e pertencem a {s.brandName}, salvo indicação em
          contrário. É proibido copiar, baixar, reproduzir, editar ou utilizar as imagens sem autorização por escrito, inclusive para treinar
          sistemas de inteligência artificial. Medidas técnicas como marca-d’água reduzem, mas não impedem totalmente, cópias de tela.
        </p>
        <h2>2. Orçamentos e propostas</h2>
        <p>
          O envio de uma solicitação não garante reserva de data. Valores, disponibilidade e condições são definidos exclusivamente na proposta
          enviada pela fotógrafa, válida pelo prazo nela indicado. Informações do assistente virtual têm caráter informativo.
        </p>
        <h2>3. Área do cliente</h2>
        <p>
          O acesso é pessoal. As galerias liberadas destinam-se ao uso previsto em contrato. Downloads, quando permitidos, seguem a licença de uso
          acordada. O compartilhamento é permitido apenas pelas ferramentas disponibilizadas e para pessoas autorizadas.
        </p>
        <h2>4. Uso adequado</h2>
        <p>Não é permitido tentar acessar áreas restritas, enviar conteúdo malicioso, automatizar envios de formulários ou sobrecarregar o site.</p>
        <h2>5. Contato</h2>
        <p>Dúvidas sobre estes termos: <a href={`mailto:${s.email}`}>{s.email}</a>.</p>
      </div>
    </article>
  );
}
