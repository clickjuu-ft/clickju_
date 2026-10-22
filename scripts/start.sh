#!/bin/sh
# Inicialização em produção: aplica migrações (idempotente), dados iniciais e sobe o site.
# Em instâncias pequenas, nada pesado roda junto com o site (um processo por vez).
set -e
echo "→ Aplicando migrações"
npm run db:migrate
if [ "${SEED_DEMO:-true}" = "false" ]; then
  echo "→ Dados iniciais"
  npm run db:seed || echo "⚠ seed falhou — veja o log acima"
else
  echo "→ Dados iniciais com demonstração (em segundo plano)"
  (npm run db:seed || echo "⚠ seed falhou — veja o log acima") &
fi
echo "→ Iniciando o site na porta ${PORT:-3000}"
exec npx next start -p "${PORT:-3000}"
