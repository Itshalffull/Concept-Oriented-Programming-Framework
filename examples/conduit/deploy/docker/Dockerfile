# Conduit Clef App — Docker Image
# Node.js 22 Alpine base with all 10 concepts and 7 syncs.

FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --production=false

# Copy full project source
COPY . .

# Build TypeScript
RUN npm run build

# --- Production stage ---
FROM node:22-alpine

WORKDIR /app

# Copy built output and production dependencies
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/specs ./specs
COPY --from=builder /app/syncs ./syncs

# Non-root user for security
RUN addgroup -S clef && adduser -S clef -G clef
USER clef

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/examples/conduit/server/server.js"]
