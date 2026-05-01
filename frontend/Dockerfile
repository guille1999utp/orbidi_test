FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .

# Build-args opcionales (p. ej. docker compose). No usar ENV con valores vacíos: en Next
# eso pisa .env.local durante `npm run build`. Si no pasas args, se usan .env / .env.local del COPY.
ARG NEXT_PUBLIC_API_URL=
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=
RUN if [ -n "$NEXT_PUBLIC_API_URL" ] || [ -n "$NEXT_PUBLIC_GOOGLE_CLIENT_ID" ]; then \
      touch .env.production.local && \
      if [ -n "$NEXT_PUBLIC_API_URL" ]; then printf '%s\n' "NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL" >> .env.production.local; fi && \
      if [ -n "$NEXT_PUBLIC_GOOGLE_CLIENT_ID" ]; then printf '%s\n' "NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID" >> .env.production.local; fi; \
    fi; \
    # BuildKit pasa ARG vacíos al entorno: Next.js mira process.env antes que .env.local y se queda con "".
    if [ -z "${NEXT_PUBLIC_GOOGLE_CLIENT_ID:-}" ]; then unset NEXT_PUBLIC_GOOGLE_CLIENT_ID; fi; \
    if [ -z "${NEXT_PUBLIC_API_URL:-}" ]; then unset NEXT_PUBLIC_API_URL; fi; \
    npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["npm", "start", "--", "--hostname", "0.0.0.0", "--port", "3000"]
