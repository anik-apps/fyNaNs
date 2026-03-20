# Stage 1: Install dependencies
FROM node:20-alpine AS deps

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/shared-types/package.json ./packages/shared-types/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Stage 2: Build
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/ ./packages/

# Copy source code
COPY apps/web/ ./apps/web/
COPY packages/ ./packages/
COPY package.json pnpm-workspace.yaml ./

# Build shared packages first
RUN pnpm --filter @fynans/shared-types build || true
RUN pnpm --filter @fynans/api-client build || true

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @fynans/web build

# Stage 3: Runtime
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Copy built standalone output
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["node", "apps/web/server.js"]
