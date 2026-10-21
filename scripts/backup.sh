#!/usr/bin/env bash
# Backup do banco (pg_dump formato custom) e dos arquivos (originais, variantes, anexos).
#   ./scripts/backup.sh [pasta-destino]
# Requer: pg_dump compatível com a versão do servidor. Para S3/R2/Supabase, use rclone ou aws cli.
# Agende diariamente e mantenha cópias fora do servidor (regra 3-2-1).
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] && set -a && . ./.env && set +a
DEST="${1:-./backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$DEST"

echo "→ Banco de dados"
pg_dump --format=custom --no-owner --file "$DEST/db-$STAMP.dump" "$DATABASE_URL"

if [ "${STORAGE_DRIVER:-local}" = "local" ]; then
  echo "→ Arquivos locais (${STORAGE_LOCAL_DIR:-./storage})"
  tar -czf "$DEST/storage-$STAMP.tar.gz" -C "${STORAGE_LOCAL_DIR:-./storage}" .
else
  echo "→ Arquivos no bucket ${S3_BUCKET}: sincronize com rclone/aws cli, por exemplo:"
  echo "   aws s3 sync s3://${S3_BUCKET} $DEST/storage-$STAMP --endpoint-url ${S3_ENDPOINT:-}"
fi

# mantém os 14 backups mais recentes de cada tipo
ls -1t "$DEST"/db-*.dump 2>/dev/null | tail -n +15 | xargs -r rm --
ls -1t "$DEST"/storage-*.tar.gz 2>/dev/null | tail -n +15 | xargs -r rm --
echo "✓ Backup em $DEST ($STAMP)"
# Restauração:
#   pg_restore --clean --no-owner -d "$DATABASE_URL" backups/db-AAAAMMDDTHHMMSSZ.dump
#   tar -xzf backups/storage-AAAAMMDDTHHMMSSZ.tar.gz -C ./storage
