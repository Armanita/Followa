# Followa API — multi-stage build (build with repo root as context)
FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /app

# Copy workspace manifests first for layer caching
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared-types/package.json packages/shared-types/

RUN pnpm install --no-frozen-lockfile --filter @followa/api...

COPY apps/api apps/api
COPY packages/shared-types packages/shared-types

# Generate Prisma client + compile TS
RUN cd apps/api && npx prisma generate && npx tsc -p tsconfig.json

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/prisma ./prisma
# runtime needs the workspace hoisted prisma client + shared-types link;
# node resolves them through /app/node_modules copied above.

EXPOSE 3001
CMD ["node", "dist/server.js"]
