# Followa Web — multi-stage build (build with repo root as context)
FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared-types/package.json packages/shared-types/

RUN pnpm install --no-frozen-lockfile --filter @followa/web...

COPY apps/web apps/web
COPY packages/shared-types packages/shared-types

# API base baked at build time (client-side fetch target)
ARG NEXT_PUBLIC_API_BASE=/api/v1
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE
RUN cd apps/web && npx next build

FROM node:22-alpine AS runner
WORKDIR /app/apps/web
ENV NODE_ENV=production PORT=3000
# full workspace tree needed because next start resolves deps via hoisted store
COPY --from=builder /app ./

EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
