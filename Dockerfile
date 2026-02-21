FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
# Smoke test DuckDB bindings
RUN node -e "require('@duckdb/node-api')"

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV DATA_DIR=/data
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
RUN mkdir -p /data/uploads /data/dashboards
EXPOSE 3000
CMD ["node", "server.js"]
