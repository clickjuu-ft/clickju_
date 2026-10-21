# Imagem de produção (Node 22).
#   docker build -t site-fotografia .
#   docker run --env-file .env -p 3000:3000 -v fotos:/app/storage site-fotografia
# Migrações/seed/retenção dentro do container:
#   docker run --env-file .env site-fotografia npm run db:migrate
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx next build && npm prune --omit=dev && npm install --no-save tsx dotenv

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 npm_config_cache=/tmp/.npm
RUN apt-get update && apt-get install -y --no-install-recommends postgresql-client && rm -rf /var/lib/apt/lists/* \
  && useradd -r -u 1001 app
COPY --from=build /app ./
RUN mkdir -p /app/storage && chown -R app /app/storage
USER app
EXPOSE 3000
CMD ["sh", "scripts/start.sh"]
