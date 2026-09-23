FROM node:24-alpine AS dependencies
WORKDIR /app

ARG SERVICE_DIR=property-insights-portal

COPY ${SERVICE_DIR}/package.json ${SERVICE_DIR}/package-lock.json ./
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app

ARG SERVICE_DIR=property-insights-portal

COPY --from=dependencies /app/node_modules ./node_modules
COPY ${SERVICE_DIR} ./
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=9000

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 9000

HEALTHCHECK \
  --interval=30s \
  --timeout=3s \
  --start-period=10s \
  --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:9000').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

CMD ["node", "server.js"]
