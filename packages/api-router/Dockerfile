# API Router Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/region-config/package.json packages/region-config/package.json
COPY packages/shared-sdk/package.json packages/shared-sdk/package.json

RUN npm ci --workspace=@agrisense/api-router --ignore-scripts

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build workspace packages first
RUN npm run build --workspace=@agrisense/region-config
RUN npm run build --workspace=@agrisense/shared-sdk

# Build the API router
RUN npm run build --workspace=@agrisense/api-router

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 agrisense

# Copy built application
COPY --from=builder /app/packages/api-router/dist ./dist
COPY --from=builder /app/packages/api-router/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

# Copy region configs
COPY --from=builder /app/regions ./regions

# Set ownership
RUN chown -R agrisense:nodejs /app
USER agrisense

EXPOSE 8000

CMD ["node", "dist/index.js"]