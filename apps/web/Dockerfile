# docker build -f apps/web/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /repo
COPY . .
RUN npm ci --no-audit --no-fund
# In-cluster Service names; baked into the rewrites at build time.
ENV SEARCH_API_URL=http://search-api GAME_API_URL=http://game-api NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_FAKE_API=0
ENV NEXT_PUBLIC_FAKE_API=${NEXT_PUBLIC_FAKE_API}
# Dash0 browser RUM (040 Behavior 7). Empty = RUM off. The token is an ingest-only token: it ends
# up in the public JS bundle by design (Dash0 Web SDK docs), so it is a build arg, not a Secret.
ARG NEXT_PUBLIC_DASH0_RUM_ENDPOINT=""
ARG NEXT_PUBLIC_DASH0_RUM_AUTH_TOKEN=""
ARG APP_VERSION=dev
ENV NEXT_PUBLIC_DASH0_RUM_ENDPOINT=${NEXT_PUBLIC_DASH0_RUM_ENDPOINT} \
    NEXT_PUBLIC_DASH0_RUM_AUTH_TOKEN=${NEXT_PUBLIC_DASH0_RUM_AUTH_TOKEN} \
    NEXT_PUBLIC_DEPLOY_ENV=demo \
    NEXT_PUBLIC_APP_VERSION=${APP_VERSION}
RUN npm run build -w apps/web

FROM node:22-alpine
ARG APP_VERSION=dev
WORKDIR /app
COPY --from=build --chown=1000:1000 /repo/apps/web/.next/standalone ./
COPY --from=build --chown=1000:1000 /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=1000:1000 /repo/apps/web/public ./apps/web/public
ENV NODE_ENV=production PORT=8080 HOSTNAME=0.0.0.0 APP_VERSION=${APP_VERSION} NEXT_TELEMETRY_DISABLED=1
USER 1000
EXPOSE 8080
CMD ["node", "apps/web/server.js"]
