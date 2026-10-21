import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { aiEnabled } from "@/lib/ai/claude";

export const metadata: Metadata = { title: "Política de privacidade", alternates: { canonical: "/privacidade" } };

export default async function PrivacyPage() {
  const s = await getSettings();
  return (
    <article className="mx-auto max-w-3xl px-5 pb-28 pt-32 md:pt-40">
      <p className="eyebrow">Documento</p>
      <h1 className="display mt-4 text-5xl md:text-7xl">Política de privacidade</h1>
      <p className="mt-4 text-sm text-mist">
        Modelo base elaborado para este site. Recomenda-se revisão por assessoria jurídica antes da publicação definitiva.
      </p>
      <div className="prose-site mt-10">
        <p>
          Esta política explica como <strong>{s.brandName}</strong> (“nós”) trata dados pessoais neste site, em conformidade com a Lei
          Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
        </p>
        <h2>1. Dados que coletamos</h2>
        <ul>
          <li>Solicitação de orçamento: nome, e-mail, WhatsApp, cidade/UF, preferência de contato, detalhes do evento e anexos que você enviar.</li>
          <li>Formulário de contato: nome, e-mail, telefone (opcional) e mensagem.</li>
          <li>Área do cliente: nome, e-mail, telefone (opcional), senha (armazenada apenas como hash), favoritas, aprovações e histórico de downloads.</li>
          <li>Dados técnicos mínimos: endereço IP convertido em código irreversível (hash) para proteção contra abuso, e navegador utilizado.</li>
        </ul>
        <h2>2. Finalidades e bases legais</h2>
        <ul>
          <li>Responder solicitações e elaborar propostas — procedimentos preliminares a contrato (art. 7º, V).</li>
          <li>Executar o serviço contratado e entregar as fotografias — execução de contrato (art. 7º, V).</li>
          <li>Segurança, prevenção de fraudes e registros de acesso — legítimo interesse e cumprimento de obrigação legal (art. 7º, II e IX).</li>
        </ul>
        <p>Não utilizamos seus dados para publicidade de terceiros nem os vendemos.</p>
        <h2>3. Compartilhamento</h2>
        <p>
          Os dados podem ser processados por fornecedores necessários ao funcionamento do site — hospedagem, banco de dados, armazenamento
          de arquivos e envio de e-mails —, sob obrigações de confidencialidade.
          {aiEnabled() &&
            " As mensagens enviadas ao assistente virtual são processadas por um provedor de inteligência artificial (Anthropic) apenas para gerar a resposta; não envie dados sensíveis pelo assistente."}
        </p>
        <h2>4. Imagens</h2>
        <p>
          Fotografias de pessoas são publicadas no portfólio somente com a devida autorização. A imagem de crianças e adolescentes exige
          consentimento específico dos responsáveis. Para solicitar a remoção de uma imagem em que você aparece, entre em contato.
        </p>
        <p>
          O site não utiliza reconhecimento facial nem identificação biométrica. Ferramentas de organização por inteligência artificial,
          quando usadas, descrevem apenas o conteúdo visual (ex.: “largada de corrida”) e não identificam pessoas.
        </p>
        <h2>5. Armazenamento e retenção</h2>
        <p>
          Pedidos de orçamento não convertidos em contrato são mantidos por até {s.retentionMonths} meses e depois excluídos ou anonimizados.
          Dados de clientes são mantidos durante a relação contratual e pelos prazos legais aplicáveis. Arquivos privados são acessados
          somente por links temporários.
        </p>
        <h2>6. Cookies e armazenamento local</h2>
        <p>
          Usamos apenas cookies essenciais: sessão de login e acesso a galerias protegidas. O rascunho do formulário de orçamento e a conversa
          com o assistente ficam somente no seu navegador, durante a sessão. Não usamos cookies de rastreamento publicitário.
        </p>
        <h2>7. Seus direitos</h2>
        <p>
          Você pode solicitar confirmação de tratamento, acesso, correção, anonimização, portabilidade, eliminação e informações sobre
          compartilhamento, além de revogar consentimentos. Clientes podem excluir a própria conta na Área do Cliente.
        </p>
        <h2>8. Contato do encarregado</h2>
        <p>
          Solicitações sobre dados pessoais: <a href={`mailto:${s.privacyContact}`}>{s.privacyContact}</a>. Respondemos em até 15 dias.
        </p>
      </div>
    </article>
  );
}
