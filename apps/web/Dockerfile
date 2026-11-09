# docker build -f apps/web/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /repo
COPY . .
RUN npm ci --no-audit --no-fund
# In-cluster Service names; baked into the rewrites at build time.
ENV SEARCH_API_URL=http://search-api GAME_API_URL=http://game-api NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_FAKE_API=0
ENV NEXT_PUBLIC_FAKE_API=${NEXT_PUBLIC_FAKE_API}
RUN npm run build -w apps/web

FROM node:22-alpine
ARG APP_VERSION=dev
WORKDIR /app
COPY --from=build --chown=1000:1000 /repo/apps/web/.next/standalone ./
COPY --from=build --chown=1000:1000 /repo/apps/web/.next/static ./apps/web/.next/static
ENV NODE_ENV=production PORT=8080 HOSTNAME=0.0.0.0 APP_VERSION=${APP_VERSION} NEXT_TELEMETRY_DISABLED=1
USER 1000
EXPOSE 8080
CMD ["node", "apps/web/server.js"]
