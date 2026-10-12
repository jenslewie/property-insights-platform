FROM node:24-alpine AS dependencies

WORKDIR /app

COPY property-insights-portal/package.json property-insights-portal/package-lock.json ./

RUN --mount=type=cache,target=/root/.npm npm ci


FROM node:24-alpine AS builder

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY property-insights-portal ./

RUN npm run build


FROM node:24-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=9000

RUN addgroup --system app && adduser --system --ingroup app app

COPY --from=builder --chown=app:app /app/public ./public
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static

USER app

EXPOSE 9000

HEALTHCHECK \
  --interval=30s \
  --timeout=3s \
  --start-period=10s \
  --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:9000').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

ENTRYPOINT ["node", "server.js"]
