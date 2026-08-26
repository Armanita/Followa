# Followa API — multi-stage build (build with repo root as context)
FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /app

# pnpm network hardening for slow/flaky registry links (pnpm-native settings).
# npmmirror is a read-only CDN mirror of the same tarballs; lockfile hashes
# still guarantee integrity, so switching the fetch source is safe.
RUN printf 'registry=https://registry.npmmirror.com\nfetch-timeout=600000\nfetch-retries=6\nfetch-retry-factor=3\nfetch-retry-mintimeout=15000\nfetch-retry-maxtimeout=120000\nnetwork-concurrency=4\n' > /root/.npmrc

# manifests + lockfile first for layer caching; frozen install is verified
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared-types/package.json packages/shared-types/
# pre-fetched tarballs for packages whose large downloads repeatedly fail
# through the Docker NAT (MTU issue); host network fetches them reliably.
# Integrity is still enforced: `pnpm store add` records them and the frozen
# install validates every tarball against the lockfile's integrity hashes.
COPY docker/pnpm-seed/ /tmp/seed/

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    sh -c 'pnpm store add /tmp/seed/prisma-6.19.3.tgz /tmp/seed/client-6.19.3.tgz 2>/dev/null || true' && \
    rm -rf /tmp/seed && \
    pnpm install --frozen-lockfile

COPY apps/api apps/api
COPY packages/shared-types packages/shared-types

# generate Prisma client against the copied schema, then compile TS
RUN cd apps/api && npx prisma generate && npx tsc -p tsconfig.json

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# whole workspace tree: node_modules (hoisted + per-importer symlinks),
# compiled dist, prisma schema/migrations for `migrate deploy`
COPY --from=builder --chown=node:node /app ./

EXPOSE 3001
CMD ["node", "apps/api/dist/server.js"]
