#!/bin/sh
# Inicialização em produção: aplica migrações (idempotente), sobe o site e,
# em segundo plano, executa o seed (idempotente) para não atrasar a abertura.
set -e
echo "→ Aplicando migrações"
npm run db:migrate
echo "→ Dados iniciais (em segundo plano)"
(npm run db:seed || echo "⚠ seed falhou — veja o log acima") &
echo "→ Iniciando o site na porta ${PORT:-3000}"
exec npx next start -p "${PORT:-3000}"
