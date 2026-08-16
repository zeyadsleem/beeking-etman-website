# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@11.21.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM node:22-alpine
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN corepack enable && corepack prepare pnpm@11.21.0 --activate && \
  pnpm install --prod --frozen-lockfile
COPY --from=build /app/build ./build
COPY --from=build /app/drizzle ./drizzle
COPY scripts/migrate.mjs ./scripts/migrate.mjs
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["sh", "-c", "node scripts/migrate.mjs && node build/index.js"]
