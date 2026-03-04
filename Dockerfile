# Stage 1: Install workspace dependencies (web only)
FROM --platform=linux/amd64 node:20-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
COPY pnpm-lock.yaml package.json ./
COPY web/package.json ./web/
# Ensure workspace narrowed to web only
RUN printf 'packages:\n  - "web"\n' > pnpm-workspace.yaml
RUN pnpm install --frozen-lockfile

# Stage 2: Build the Next.js app
FROM --platform=linux/amd64 node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/web/node_modules ./web/node_modules
COPY . .
# Sentry client DSN is injected at build time via --build-arg.
# Defaults to empty so local/test Docker builds don't fail.
ARG NEXT_PUBLIC_SENTRY_DSN=""
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
ENV SENTRY_SUPPRESS_TURBOPACK_WARNING=1
RUN cd web && pnpm build

# Stage 3: Production image
FROM --platform=linux/amd64 node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Next.js standalone server binds to localhost by default.
# Cloud Run routes traffic to the container via its proxy, so the
# server must listen on all interfaces.
ENV HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/web/.next/standalone ./
COPY --from=builder /app/web/.next/static ./web/.next/static
COPY --from=builder /app/web/public ./web/public
USER nextjs
EXPOSE 3000
ENV NEXT_MANUAL_SIG_HANDLE=true
CMD ["node", "web/server.js"]
