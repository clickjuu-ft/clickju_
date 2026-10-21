# Clickju — site profissional de fotografia

Plataforma completa para uma fotógrafa profissional: portfólio dinâmico, **orçamento funcional**, painel comercial (tabela + kanban), **propostas em PDF com aceite online**, portal do cliente com galerias privadas, e recursos de **inteligência artificial** com revisão humana.

Identidade: **branco predominante**, preto para texto e roxo de destaque (`#8B5CF6`), com tipografia condensada (Archivo) e itálico editorial (Instrument Serif). Hero, rodapé e o visualizador de fotos são “ilhas” escuras para valorizar a fotografia.

---

## Sumário

1. [Stack e arquitetura](#stack-e-arquitetura)
2. [Executar localmente](#executar-localmente)
3. [Funcionalidades implementadas](#funcionalidades-implementadas)
4. [O que depende de credenciais externas](#o-que-depende-de-credenciais-externas)
5. [Configurar cada integração](#configurar-cada-integração)
6. [Banco de dados e migrações](#banco-de-dados-e-migrações)
7. [Publicação](#publicação)
8. [Segurança e LGPD](#segurança-e-lgpd)
9. [Backup e retenção](#backup-e-retenção)
10. [Testes](#testes)
11. [Estrutura de pastas](#estrutura-de-pastas)
12. [Limitações conhecidas e próximos passos](#limitações-conhecidas-e-próximos-passos)

---

## Stack e arquitetura

| Camada | Tecnologia |
|---|---|
| Aplicação | Next.js 16 (App Router, Server Components, Server Actions), React 19, TypeScript |
| Estilo | Tailwind CSS v4 com tokens de cor (tema claro + “ilhas escuras” via `.theme-dark`) |
| Animação | Motion (Framer Motion), respeitando `prefers-reduced-motion` |
| Banco | PostgreSQL (local, **Supabase** ou Neon) via Drizzle ORM + migrações SQL versionadas |
| Arquivos | Driver plugável: disco local **ou** S3 (Supabase Storage, Cloudflare R2, AWS S3) |
| Imagens | `sharp`: variantes AVIF/WebP (480/960/1600/2400 px), placeholder desfocado, marca-d’água, análise técnica |
| Autenticação | Própria: senhas com scrypt, sessões em banco (cookie httpOnly), papéis `admin`/`client` |
| E-mail | Resend (API) ou SMTP (nodemailer) |
| IA | Claude (Anthropic SDK) para assistente, legendas e sequência; Voyage AI (opcional) para busca semântica; Replicate (opcional) para upscale/remoção de fundo |
| PDF | pdfkit (propostas) |
| Testes | Vitest (unitários/integração com Postgres real) e Playwright (E2E, desktop e celular) |

Separação de responsabilidades:

- `src/lib/*` — domínio e integrações (somente servidor, protegidos com `server-only`).
- `src/server/*` — Server Actions (cada uma revalida permissão no servidor).
- `src/app/api/*` — rotas HTTP (upload, orçamento, mídia assinada, PDF, CSV, chat).
- `src/components/*` — interface (componentes de cliente somente onde há interação).
- `src/lib/quotes/schema.ts` — validação **compartilhada** (navegador para feedback, servidor como fonte da verdade).

Nenhuma chave secreta é enviada ao navegador (apenas variáveis `NEXT_PUBLIC_*`, e só a chave pública opcional do Turnstile usa esse prefixo).

---

## Executar localmente

Pré-requisitos: **Node.js 20.9+** (recomendado 22) e **PostgreSQL 14+**.

```bash
# 1. dependências
npm install

# 2. banco
createdb fotografia            # ou crie no Supabase e copie a connection string

# 3. variáveis
cp .env.example .env           # preencha DATABASE_URL e APP_SECRET (openssl rand -base64 48)

# 4. estrutura do banco + dados iniciais
npm run db:migrate
npm run db:seed                # cria admin, categorias, serviços e projetos DEMONSTRATIVOS
#   npm run db:seed -- --no-demo   → sem projetos/imagens de demonstração

# 5. desenvolvimento
npm run dev                    # http://localhost:3000  ·  painel: /admin
```

O seed mostra a senha do administrador uma única vez (ou usa `ADMIN_PASSWORD`). As imagens de demonstração são composições abstratas geradas por computador, marcadas como “DEMO” e “Demonstração” no site — substitua-as pelo painel.

Scripts úteis:

| Comando | Função |
|---|---|
| `npm run dev` / `build` / `start` | desenvolvimento, build e produção |
| `npm run db:migrate` | aplica migrações (`drizzle/`) |
| `npm run db:generate` | gera nova migração após alterar `src/lib/db/schema.ts` |
| `npm run db:seed` | dados iniciais (idempotente) |
| `npm test` | testes unitários/integração (banco `foto_test`) |
| `npm run test:e2e` | testes ponta a ponta (requer `npm run build` antes) |
| `npm run retention` | política de retenção LGPD (`-- --dry` para simular) |
| `npm run backup` | backup do banco e dos arquivos |
| `npm run typecheck` / `lint` | verificação de tipos e lint |

---

## Funcionalidades implementadas

Tudo abaixo está **funcionando e coberto por testes ou verificado no navegador** (salvo onde indicado).

### Site público
- Página inicial: hero em tela cheia (foto separada para desktop e celular), nome/título editáveis, botões “Solicitar orçamento” e “Explorar portfólio”, projetos em destaque (grade assimétrica), índice editorial de categorias com prévia, apresentação, **colagem flutuante** de trabalhos recentes com paralaxe, depoimentos (**somente quando cadastrados** — nenhum é inventado), chamada final com WhatsApp, rodapé completo.
- Portfólio: filtros por categoria, evento e ano; busca por palavra-chave (título, local, evento, legendas e etiquetas das fotos, com índice de texto em português).
- Página de projeto: galeria em **grade editorial** ou **mosaico (masonry)**, visualização em tela cheia com **teclado** (← → Esc + −), **gestos** (arrastar para trocar/fechar), **zoom até a resolução real** da maior variante (duplo clique/toque, roda do mouse, arrastar para mover), link direto para uma foto (`#foto-…`), compartilhamento (Web Share, copiar link, WhatsApp), CTA de orçamento com o serviço pré-selecionado.
- Galerias **protegidas por senha**, **somente com link**, ou **privadas** (clientes autorizados). Links de compartilhamento com validade e revogação (`/g/<token>`).
- Serviços (com preço apenas se a fotógrafa decidir exibir), Sobre, Contato (formulário que **grava** a mensagem + botões de WhatsApp/Instagram/e-mail), Blog opcional, Política de privacidade e Termos (modelos para revisão jurídica), 404 e página de erro.
- SEO: metadados e Open Graph por página/projeto, URLs amigáveis, `sitemap.xml` (só conteúdo público), `robots.txt`, `X-Robots-Tag: noindex` nas áreas privadas.

### Orçamento (prioritário)
- Formulário em **5 etapas** com indicador de progresso, máscara de WhatsApp, validação por etapa, mensagens claras, foco no primeiro erro, **revisão com “Editar”** em cada bloco, aviso de privacidade e consentimento LGPD, anexos opcionais (até 5 × 10 MB, arrastar e soltar), rascunho salvo na sessão do navegador, funciona sem cadastro e no celular.
- Processamento no servidor: revalidação completa (inclusive contra serviços/opções cadastrados), **honeypot**, **tempo mínimo de preenchimento com token assinado**, **limite por IP**, heurística de links, Cloudflare Turnstile opcional, verificação de origem (CSRF).
- Código único (`ORC-2026-XXXXXX`), status inicial “Novo pedido”, data/hora, histórico; **gravação atômica** (pedido + anexos): se algo falhar, nada fica salvo.
- **A confirmação só aparece com resposta 201 do servidor**; em erro, os dados permanecem e há botão “Tentar novamente”.
- E-mail à fotógrafa e confirmação ao cliente **quando configurado** (o status real fica registrado e visível no painel).
- Botão para continuar no WhatsApp com o código do pedido.

### Painel administrativo (`/admin`)
- Visão geral: novos pedidos, em andamento, aprovados no mês (valor), lembretes vencidos/próximos, pedidos recentes e **status real das integrações**.
- Orçamentos: **tabela e kanban** (arrastar entre colunas ou seletor acessível), **contadores por status**, busca (nome, e-mail, código, telefone, cidade, descrição), filtros por serviço, período e arquivados, **exportação CSV** (com proteção contra injeção de fórmulas e sem IP).
- Detalhe do pedido: todos os dados, anexos por link temporário, troca de status, **observações internas**, **histórico de contatos** (canal), **valor da proposta**, **validade**, **resultado da negociação**, **lembretes** com conclusão, solicitações anteriores do mesmo cliente, arquivar/desarquivar, **anonimização LGPD**.
- **Propostas**: rascunho criado a partir do pedido (valores sempre definidos pela fotógrafa), escopo, horas, entregáveis, prazo, itens, total, pagamento, validade, condições; **PDF** com a identidade visual; envio com **link de aceite** (exibido uma vez; o anterior é invalidado) e e-mail opcional; página pública com **aceite eletrônico** (nome + concordância), que marca o pedido como aprovado e notifica a fotógrafa. Nada confirma disponibilidade automaticamente.
- Portfólio: projetos (CRUD), visibilidade, senha, destaque, publicação, ordem, **marca-d’água por projeto**; **upload múltiplo** com lotes nomeados, progresso, envios paralelos e nova tentativa; validação pelo conteúdo real; grade com **seleção múltipla, arrastar para reordenar**, capa, edição de legenda/texto alternativo/etiquetas, **mover entre projetos**, excluir (remove também os arquivos); nota técnica por foto.
- Acesso de clientes por e-mail (convite vale mesmo antes do cadastro), permissões de download/compartilhamento e validade; links de compartilhamento; **exportação da seleção** dos clientes (CSV).
- Categorias, serviços (opções do formulário), depoimentos (com confirmação de autorização), base de conhecimento do assistente, blog, mensagens de contato, clientes (desativar/reativar), **configurações** (textos, fotos do hero/sobre, contato, redes, marca-d’água, SEO, retenção, **upload das logos oficiais** em 3 versões, opções do formulário de orçamento), troca de senha, **registro de atividades** (auditoria somente-inserção).

### Portal do cliente (`/cliente`)
- Cadastro, login, **recuperação de senha** por link de uso único (1 h), troca de senha, **exclusão da própria conta**.
- Somente galerias liberadas para o e-mail da conta (verificado no servidor; projetos alheios retornam 404).
- **Favoritas**, **aprovação** de fotos, filtros (todas/favoritas/aprovadas), **download do original** quando permitido (registrado na auditoria), envio da seleção à fotógrafa, **etapa do projeto** e informações/data de entrega, **compartilhamento controlado** (convite somente-visualização, se permitido), **notificações** de novas galerias.

### Inteligência artificial (com revisão humana)
- **Assistente virtual** em português: responde somente com serviços, preços *explicitamente divulgados*, contatos e a base de conhecimento cadastrada; não inventa preços nem confirma datas; **pré-preenche o formulário** de orçamento via ferramenta; limite de uso por IP. Sem chave de IA, funciona em **modo básico** (busca por palavras-chave), identificado na interface.
- **Legendas, texto alternativo, etiquetas, categoria, cena e modalidade** (visão computacional com saída estruturada) — ficam como **sugestões pendentes** para aceitar (com edição) ou rejeitar.
- **Busca por descrição de cena/modalidade**: semântica por imagem com Voyage AI (se configurado) ou textual em legendas/etiquetas.
- **Imagens semelhantes** e **agrupamento por similaridade** (hash perceptual + histograma de cor, e embeddings quando houver) — local, sem enviar dados.
- **Sugestão de seleção** por critérios técnicos (nitidez via Laplaciano, exposição e áreas estouradas) — a melhor de cada grupo, sempre para confirmação.
- **Coleções** de favoritas, **sequência narrativa** sugerida (IA ou heurística cronológica sem repetir semelhantes), aplicação somente após confirmar, **exportação de listas**.
- **Ferramentas de imagem** que geram **arquivos novos** (o original nunca é tocado): redução de ruído, correção assistida de iluminação, preparação para web, redimensionamento inteligente (1:1, 4:5, 16:9 com recorte por atenção) — locais; aprimoramento de resolução e remoção de fundo via Replicate (opcional).
- Sem reconhecimento facial/biométrico: os prompts proíbem identificar pessoas.

---

## O que depende de credenciais externas

| Recurso | Sem credencial | Variáveis |
|---|---|---|
| E-mails (notificação, confirmação, recuperação de senha, convites, propostas) | **Não são enviados**; o painel mostra “não enviado”. Em desenvolvimento, o conteúdo/link aparece no terminal. | `RESEND_API_KEY` ou `SMTP_URL`, `EMAIL_FROM`, `NOTIFY_EMAIL` |
| Assistente com IA, legendas/etiquetas, sequência por IA | Assistente em modo básico; análise visual indisponível (mensagem clara); sequência heurística | `ANTHROPIC_API_KEY` (`AI_MODEL` opcional) |
| Busca semântica por imagem | Busca textual | `VOYAGE_API_KEY` |
| Aprimoramento de resolução e remoção de fundo | Opções desabilitadas no painel | `REPLICATE_API_TOKEN`, `REPLICATE_UPSCALE_MODEL`, `REPLICATE_BACKGROUND_MODEL` |
| Armazenamento em nuvem/CDN | Disco local | `STORAGE_DRIVER=s3`, `S3_*` |
| Anti-robô Turnstile | Demais camadas antispam continuam ativas | `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` |

A integração com Claude foi escrita conforme a documentação oficial do SDK e passa na verificação de tipos, mas **não foi executada contra a API neste ambiente** (sem chave). Idem Resend/SMTP, Voyage e Replicate.

---

## Configurar cada integração

### Supabase (banco + armazenamento)
1. Crie um projeto em supabase.com.
2. **Banco**: *Project Settings → Database → Connection string*. Use o pooler em **modo sessão** (porta 5432) como `DATABASE_URL`. Se usar o modo transação (6543), defina `DATABASE_PREPARE=false`.
3. Rode `npm run db:migrate` e `npm run db:seed`. A migração `0001` ativa **RLS em todas as tabelas sem políticas públicas** e revoga acesso dos papéis `anon`/`authenticated`: a API REST pública do Supabase não expõe nada; somente o servidor do site (dono das tabelas) acessa os dados.
4. **Armazenamento**: *Storage → New bucket* `fotografias` (**privado**). Em *Storage → S3 Connection*, gere as chaves e configure:
   ```
   STORAGE_DRIVER=s3
   S3_ENDPOINT=https://<ref>.supabase.co/storage/v1/s3
   S3_REGION=<região do projeto>
   S3_BUCKET=fotografias
   S3_ACCESS_KEY_ID=...
   S3_SECRET_ACCESS_KEY=...
   S3_FORCE_PATH_STYLE=true
   ```
   Todos os objetos ficam privados; o site gera **URLs assinadas temporárias** (estáveis por ~1 dia para conteúdo público, permitindo cache; ~1 h para privado).

Cloudflare R2: `S3_ENDPOINT=https://<conta>.r2.cloudflarestorage.com`, `S3_REGION=auto`.

### E-mail (Resend)
1. Crie a conta em resend.com, verifique seu domínio (registros DNS SPF/DKIM).
2. `RESEND_API_KEY=re_...`, `EMAIL_FROM="Clickju <contato@seudominio.com.br>"`, `NOTIFY_EMAIL=clickjuu@gmail.com`.
Alternativa SMTP: `SMTP_URL=smtps://usuario:senha@smtp.provedor.com:465`.

### Claude (Anthropic)
1. Gere uma chave em console.anthropic.com → `ANTHROPIC_API_KEY`.
2. Modelo padrão `claude-opus-5-5` (altere com `AI_MODEL`). As chamadas usam esforço baixo para o chat/legendas, saída estruturada validada e o **fallback automático do servidor** (`fallbacks: "default"`) caso uma requisição seja recusada pelos classificadores de segurança.
3. Cadastre em **Painel → Base do assistente** suas políticas (deslocamento, pagamento, prazos, direitos de imagem). O assistente só responde com o que estiver lá e nos serviços.

### Voyage AI (busca semântica por imagem)
`VOYAGE_API_KEY` → em **Painel → IA → Busca**, clique em “Indexar fotos”. Embeddings ficam em `photos.embedding` (JSON). Para dezenas de milhares de fotos, considere migrar para `pgvector`.

### Replicate (upscale e remoção de fundo)
`REPLICATE_API_TOKEN` e os modelos desejados, no formato `dono/modelo` (modelos oficiais) ou `dono/modelo:versão`. O modelo deve aceitar uma entrada `image`. A imagem enviada é limitada a 2048 px; o resultado é salvo como **arquivo derivado** para download.

### Cloudflare Turnstile (opcional)
Crie um widget em dash.cloudflare.com → Turnstile e defina `NEXT_PUBLIC_TURNSTILE_SITE_KEY` e `TURNSTILE_SECRET_KEY`. O widget aparece na etapa de revisão do orçamento.

### Logo oficial
Envie em **Painel → Configurações → Logos oficiais** (SVG ideal; SVG com scripts é recusado). Versão branca: cabeçalho sobre o hero e rodapé; preta: cabeçalho branco ao rolar; roxa: destaque no rodapé. Sem arquivo, o site usa a marca CLI/CKJU® recriada em tipografia.

---

## Banco de dados e migrações

Esquema em `src/lib/db/schema.ts`; migrações SQL em `drizzle/`:

- `0000_init.sql` — tabelas e índices.
- `0001_rls_and_hardening.sql` — RLS ativado em todas as tabelas, revogação para `anon`/`authenticated` (Supabase), gatilho que impede alterar `audit_logs`.
- `0002_contact_messages.sql` — mensagens de contato.

| Grupo | Tabelas |
|---|---|
| Usuários | `users` (papel admin/client), `sessions` (hash do token), `password_resets` |
| Configuração | `settings` (JSON: textos, contato, marca-d’água, logos, opções do formulário) |
| Portfólio | `categories`, `projects` (visibilidade, senha, marca-d’água, etapa de entrega), `upload_batches`, `photos` (original, variantes, análise técnica, busca, embedding), `collections`, `ai_suggestions`, `image_jobs` |
| Clientes | `project_access` (por e-mail/usuário, download, compartilhamento, validade), `favorites`, `approvals`, `share_links`, `notifications` |
| Comercial | `services`, `quote_requests`, `quote_events` (notas, contatos, status), `quote_reminders`, `proposals` |
| Conteúdo | `testimonials`, `knowledge_base`, `blog_posts`, `contact_messages` |
| Infra | `audit_logs`, `rate_limits`, `email_log` |

Para alterar o esquema: edite `schema.ts` → `npm run db:generate` → revise o SQL → `npm run db:migrate`.

---

## Publicação

**Recomendado:** um host Node com disco/volume ou S3 — Railway, Render, Fly.io ou VPS — + Supabase (Postgres + Storage).

### Docker (VPS, Railway, Render, Fly.io)
```bash
docker build -t clickju .
docker run --env-file .env clickju npm run db:migrate
docker run --env-file .env clickju npm run db:seed -- --no-demo
docker run -d --env-file .env -p 3000:3000 -v clickju-fotos:/app/storage clickju
```
Coloque um proxy com HTTPS (Caddy/Nginx) na frente e defina `APP_URL=https://seudominio.com.br`. Ajuste o limite de corpo do proxy para os uploads (ex.: Nginx `client_max_body_size 50m;`).

### VPS sem Docker
```bash
npm ci && npm run build && npm run db:migrate
NODE_ENV=production npx next start -p 3000   # use systemd ou pm2
```

### Vercel
Funciona com `STORAGE_DRIVER=s3`, porém as funções da Vercel limitam o corpo das requisições a ~4,5 MB: **uploads de fotos maiores falham**. Para fotógrafos (arquivos de 10–40 MB), prefira um host Node. (Próximo passo possível: upload direto ao bucket com URL pré-assinada.)

### Checklist pós-publicação
- [ ] `APP_SECRET` forte e exclusivo; `APP_URL` com https.
- [ ] Senha do admin trocada; e-mail configurado e testado (recuperar senha).
- [ ] Demonstrações substituídas (`npm run db:seed -- --no-demo` em banco novo, ou exclua os projetos “Demonstração”).
- [ ] Textos de Sobre, Política de privacidade e Termos revisados.
- [ ] Agendar `npm run retention` (diário) e `npm run backup` (diário, cópia externa).
- [ ] Domínio no Search Console apontando para `/sitemap.xml`.

---

## Segurança e LGPD

- Senhas com **scrypt** (sal por usuário); sessões aleatórias de 256 bits, guardadas como hash, cookie `httpOnly`/`SameSite=Lax`/`Secure` em produção; resposta de login idêntica para e-mail inexistente (anti-enumeração); limite de tentativas por IP e por e-mail.
- **Controle de acesso por função** checado no servidor em todas as páginas, ações e rotas (o `proxy.ts` é só um atalho otimista). Ações de servidor exigem mesma origem (CSRF); rotas POST verificam `Origin`.
- **Galerias privadas**: regra única (`canViewProject`); cookie de galeria assinado e vinculado à senha atual; cliente sem acesso recebe 404.
- **Arquivos**: todos privados no armazenamento; acesso por **URL assinada com validade**; originais nunca servidos ao público (somente download autorizado, auditado); proteção contra *path traversal*; cabeçalhos `nosniff` + CSP restritiva na rota de mídia; EXIF/GPS removidos das variantes.
- **Uploads**: tipo verificado pelo conteúdo, limites de tamanho e de megapixels, nomes sanitizados; SVG de logo sem conteúdo ativo.
- **Antispam**: honeypot, token de tempo mínimo, limites por IP (Postgres), heurística de links, Turnstile opcional.
- **Auditoria**: logins, exportações, alterações, downloads e acessos em `audit_logs` (somente inserção), IP armazenado como hash.
- **Cabeçalhos**: `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Robots-Tag: noindex` em áreas privadas.
- **LGPD**: consentimento registrado com data, minimização (IP em hash), política de privacidade, anonimização de pedidos pelo painel, exclusão da conta pelo próprio cliente, retenção automática, sem reconhecimento facial.
- **Imagens de pessoas**: publique somente com autorização; para **crianças**, é necessário consentimento dos responsáveis (ECA/LGPD art. 14).
- Nenhuma técnica impede totalmente capturas de tela ou cópias de imagens exibidas — a marca-d’água e as URLs temporárias reduzem o reaproveitamento, não o eliminam.

---

## Backup e retenção

- `npm run backup [pasta]` — `pg_dump` (formato custom) + arquivos locais em `.tar.gz`; mantém os 14 mais recentes. Para S3/R2, o script mostra o comando de sincronização. **Restauração**: `pg_restore --clean --no-owner -d "$DATABASE_URL" arquivo.dump` e extrair o `.tar.gz` em `./storage`. No Supabase, ative também os backups automáticos do plano.
- `npm run retention` — anonimiza pedidos encerrados após *N* meses (Configurações), apaga anexos, remove sessões/links expirados, limites de taxa antigos, registros de e-mail > 12 meses e auditoria > `AUDIT_RETENTION_MONTHS`.

---

## Testes

```bash
# unitários + integração (Postgres real, banco separado; o esquema é recriado)
createdb foto_test            # ou defina TEST_DATABASE_URL
npm test

# ponta a ponta (build de produção, banco foto_e2e, desktop e celular)
createdb foto_e2e             # ou defina E2E_DATABASE_URL
npm run build && npm run test:e2e
```

Cobertura atual — **32 testes unitários/integração** e **18 E2E** (todos passando):
- Validação do orçamento (máscaras, datas, consentimento), gravação real, código único, catálogo, anexos verificados pelo conteúdo, **atomicidade** (falha no armazenamento não deixa registro), e-mail não configurado registrado como “não enviado”, antispam.
- Envio completo pelo navegador (desktop e celular), confirmação somente após gravação, falha do servidor com nova tentativa sem perder dados, rejeição de envios automatizados.
- Senhas, URLs assinadas (válida/adulterada/expirada/sem assinatura), *path traversal*, limite de taxa.
- Regras de acesso: público, rascunho, privado (anônimo/outro cliente/autorizado/admin), senha, acesso expirado, cookie de galeria por projeto e invalidado ao trocar a senha.
- Painel protegido (redirecionamento, cliente barrado, CSV 401, `noindex`), login sem enumeração.
- Galerias: privada bloqueada, cliente autorizado favorita e baixa original, senha errada/certa, URLs adulteradas recusadas.
- Imagens: variantes AVIF/WebP, original preservado byte a byte (inclusive ao reaplicar marca-d’água), marca-d’água sem injeção, nota técnica, agrupamento e sequência.

---

## Estrutura de pastas

```
src/
  app/
    (site)/            páginas públicas, login, orçamento, portfólio, proposta pública
    admin/             painel (protegido)
    cliente/           portal do cliente (protegido)
    api/               rotas: quotes, upload, media assinada, chat, PDFs, CSV, download
    g/[token]/         links de compartilhamento
  components/          ui, site, portfolio, quote, admin, client
  lib/
    db/                esquema Drizzle e conexão
    auth/              sessões e autorização
    quotes/            validação compartilhada, serviço e consultas
    proposals/         PDF e numeração
    images/            pipeline sharp (variantes, marca-d’água, análise)
    ai/                Claude, visão, chat, embeddings, similaridade, ferramentas
    storage/           drivers local e S3
    email/             Resend/SMTP + layout
  server/              Server Actions (admin, cliente, auth, contato)
  proxy.ts             verificação otimista de sessão (Next 16)
drizzle/               migrações SQL
scripts/               migrate, seed, imagens demo, retenção, backup, fixtures E2E
tests/unit, tests/e2e
```

---

## Limitações conhecidas e próximos passos

- **Fotos de demonstração** são abstratas (o ambiente de desenvolvimento não tinha acesso a bancos de imagem). Substitua pelas suas no painel.
- Integrações externas (Claude, Resend/SMTP, Voyage, Replicate, S3) estão implementadas, mas **só foram testadas sem credenciais** (caminhos de “não configurado”). Valide cada uma ao inserir as chaves.
- Uploads são processados de forma síncrona (≈2–5 s por foto, 2 em paralelo). Para lotes muito grandes, uma fila de processamento em segundo plano é a evolução natural.
- Download em lote (ZIP) das favoritas ainda não existe; o cliente baixa arquivo por arquivo.
- Na Vercel, uploads acima de ~4,5 MB exigem upload direto ao bucket (não implementado).
- Textos de Privacidade/Termos são modelos — revise com assessoria jurídica.
