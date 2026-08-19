# ==============================================================================
# Multi-Stage Dockerfile for Commercial Attendance Platform (Next.js 16 + Prisma)
# Build Context: Repository Root (zk-k14-commercial)
# Node Version: Node.js 22 LTS (Alpine)
# ==============================================================================

FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

# ------------------------------------------------------------------------------
# Stage 1: Dependencies Installation
# ------------------------------------------------------------------------------
FROM base AS deps
WORKDIR /app

# Copy package manifests, configuration and schema
COPY package.json package-lock.json* prisma.config.ts* ./
COPY dashboard/package.json dashboard/package-lock.json* dashboard/prisma.config.ts* ./dashboard/
COPY prisma/schema.prisma ./prisma/

# Install root dependencies
RUN npm ci || npm install --no-audit

# Install dashboard dependencies and generate Prisma client
WORKDIR /app/dashboard
RUN npm ci || npm install --no-audit
RUN npx prisma generate --schema=../prisma/schema.prisma

# ------------------------------------------------------------------------------
# Stage 2: Application Builder
# ------------------------------------------------------------------------------
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/dashboard/node_modules ./dashboard/node_modules
COPY prisma.config.ts* ./
COPY prisma ./prisma
COPY dashboard ./dashboard

WORKDIR /app/dashboard
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 3: Production Runtime Runner
# ------------------------------------------------------------------------------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root system user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output from Next.js builder
COPY --from=builder --chown=nextjs:nodejs /app/dashboard/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/dashboard/.next/static ./dashboard/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/dashboard/public ./dashboard/public

USER nextjs

EXPOSE 3000

CMD ["node", "dashboard/server.js"]

# ------------------------------------------------------------------------------
# Stage 4: Database Migration & Bootstrap Runner
# ------------------------------------------------------------------------------
FROM base AS migrator
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json* prisma.config.ts* ./
COPY prisma ./prisma
COPY src/scripts ./src/scripts
COPY src/config ./src/config
COPY tsconfig.json ./

CMD ["sh", "-c", "npx prisma migrate deploy && npx ts-node src/scripts/seed.ts"]
