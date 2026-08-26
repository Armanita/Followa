# Followa Web — multi-stage build (build with repo root as context)
FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /app

# pnpm network hardening for slow/flaky registry links (pnpm-native settings).
# npmmirror is a read-only CDN mirror of the same tarballs; lockfile hashes
# still guarantee integrity, so switching the fetch source is safe.
RUN printf 'registry=https://registry.npmmirror.com\nfetch-timeout=600000\nfetch-retries=6\nfetch-retry-factor=3\nfetch-retry-mintimeout=15000\nfetch-retry-maxtimeout=120000\nnetwork-concurrency=4\n' > /root/.npmrc

# manifests + lockfile first for layer caching; frozen install is verified
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared-types/package.json packages/shared-types/

# full workspace install (not filtered): keeps next and all importer
# symlinks intact inside the hoisted store.
# Shares the same pnpm cache mount as the API image — one download serves both.
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY apps/web apps/web
COPY packages/shared-types packages/shared-types

ARG NEXT_PUBLIC_API_BASE=/api/v1
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE
RUN cd apps/web && npx next build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000
# full workspace tree at /app so apps/web resolves its deps normally
COPY --from=builder --chown=node:node /app ./

EXPOSE 3000
# direct execution of the pinned Next binary shipped in the image —
# never touches npx/npm or the registry at runtime. Absolute path so it
# works with any container working directory.
CMD ["node", "/app/apps/web/node_modules/next/dist/bin/next", "start", "-p", "3000"]
