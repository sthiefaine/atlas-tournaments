# Atlas Tournament — image de production pour Coolify.
# `npm start` applique les migrations (drizzle/*.sql) puis lance Next :
# la base Postgres n'est joignable que DANS le réseau Coolify.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Le commit de la mise en ligne, fourni par Coolify au build : la mention de
# version de l'écran-titre le lit (`next.config.ts`) ; sans lui, `.git` copié
# ci-dessus suffit.
ARG SOURCE_COMMIT
ENV NEXT_TELEMETRY_DISABLED=1 \
    SOURCE_COMMIT=$SOURCE_COMMIT
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

# pg_dump pour la copie de sécurité avant migration. Le serveur est en
# Postgres 18 : le client doit être de la même majeure, sinon pg_dump refuse
# (« server version mismatch ») et scripts/migrate.mjs le signale.
RUN apk add --no-cache postgresql18-client || apk add --no-cache postgresql-client

# En mode non-standalone, `next start` sert public/ à l'exécution ; content/
# (canon JSON, glossaires) et drizzle/ sont lus au démarrage.
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/content ./content

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" || exit 1

CMD ["npm", "start"]
