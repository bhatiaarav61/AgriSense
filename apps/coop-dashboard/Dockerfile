# Cooperative Dashboard Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared-sdk/package.json packages/shared-sdk/package.json

RUN npm ci --workspace=@agrisense/coop-dashboard --ignore-scripts

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build shared SDK first
RUN npm run build --workspace=@agrisense/shared-sdk

# Build the dashboard
RUN npm run build --workspace=@agrisense/coop-dashboard

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/apps/coop-dashboard/.next/standalone ./
COPY --from=builder /app/apps/coop-dashboard/.next/static ./.next/static
COPY --from=builder /app/apps/coop-dashboard/public ./public

# Set ownership
RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]